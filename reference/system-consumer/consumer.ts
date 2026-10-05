import { createHash, randomBytes } from "node:crypto";

/**
 * The portal contract as a System backend consumes it. This file is the reference for
 * what a real System (CRMS, HRMS, POS, IMS) must do; it has no dependency on the portal
 * codebase, only on `fetch`. See docs/integrations/system-integration-guide.md.
 */

export type ConsumerConfig = {
  /** Origin of the portal, e.g. https://auth.example.com. */
  portalUrl: string;
  /** The System's registered name, e.g. "CRMS". */
  systemName: string;
  /** Backend secret printed once by `npm run system:register`. Server-side only. */
  backendSecret: string;
  /** Exactly one of the System's registered callbacks. */
  callbackUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
};

/**
 * Why a request was not allowed. Every one of these denies; they differ in what the
 * System should do next.
 *
 * - `sign_in_required`: no usable handle. Send the browser through the handoff again.
 * - `no_access`: signed in, but this User may not use this Module right now.
 * - `unavailable`: the portal could not decide. Retryable; never fall back to allow.
 * - `misconfigured`: this System's credentials or request are wrong. Page an operator.
 */
export type DenialReason = "sign_in_required" | "no_access" | "unavailable" | "misconfigured";

export type Decision =
  | { allow: true; userId: string }
  | { allow: false; reason: DenialReason; retryable: boolean };

export type SignInResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "invalid_callback" | "invalid_grant" | DenialReason; retryable: boolean };

const PENDING_TTL_MS = 10 * 60 * 1000;

const deny = (reason: DenialReason): Decision => ({
  allow: false,
  reason,
  retryable: reason === "unavailable",
});

export function createSystemConsumer(config: ConsumerConfig) {
  const portal = config.portalUrl.replace(/\/+$/, "");
  const send = config.fetch ?? fetch;
  const now = config.now ?? Date.now;
  const authorization = `Basic ${Buffer.from(`${config.systemName}:${config.backendSecret}`).toString("base64")}`;

  // Server-side state. A real System keeps these in its own session store. The
  // browser only ever holds the opaque `sessionId` returned by completeSignIn.
  const pending = new Map<string, { verifier: string; createdAt: number }>();
  const sessions = new Map<string, { handle: string }>();

  async function post(path: string, body: unknown): Promise<{ status: number; error?: string; body: Record<string, unknown> } | null> {
    try {
      const response = await send(`${portal}${path}`, {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      return { status: response.status, error: typeof parsed.error === "string" ? parsed.error : undefined, body: parsed };
    } catch {
      // Network failure reaching the portal is an outage, not a decision.
      return null;
    }
  }

  return {
    /**
     * Step 1: where to send the browser. Works for both entry points — a User who typed
     * the System's address (direct entry) and one who clicked its portal card. The portal
     * decides whether to show login or to hand back a code straight away.
     */
    startSignIn(): { authorizeUrl: string } {
      const verifier = randomBytes(32).toString("base64url");
      const state = randomBytes(24).toString("base64url");
      const url = new URL(`${portal}/api/integrations/authorize`);

      // Abandoned sign-ins would otherwise accumulate.
      for (const [key, value] of pending) {
        if (now() - value.createdAt > PENDING_TTL_MS) {
          pending.delete(key);
        }
      }

      pending.set(state, { verifier, createdAt: now() });
      url.searchParams.set("system", config.systemName);
      url.searchParams.set("redirect_uri", config.callbackUrl);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
      url.searchParams.set("code_challenge_method", "S256");

      return { authorizeUrl: url.toString() };
    },

    /**
     * Step 2: the browser came back to the callback. Check `state` against what this
     * browser started, then exchange the code from the backend. The code is single-use
     * and is spent by the first attempt, so a failure means starting over.
     */
    async completeSignIn(callbackRequestUrl: string): Promise<SignInResult> {
      const url = new URL(callbackRequestUrl);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const started = state ? pending.get(state) : undefined;

      if (!code || !state || !started) {
        return { ok: false, reason: "invalid_callback", retryable: false };
      }

      pending.delete(state); // one attempt per start

      if (now() - started.createdAt > PENDING_TTL_MS) {
        return { ok: false, reason: "invalid_callback", retryable: false };
      }

      const result = await post("/api/integrations/exchange", {
        code,
        code_verifier: started.verifier,
        redirect_uri: config.callbackUrl,
        state,
      });

      if (!result) {
        return { ok: false, reason: "unavailable", retryable: true };
      }

      if (result.status === 200 && typeof result.body.handle === "string") {
        const sessionId = randomBytes(24).toString("base64url");
        sessions.set(sessionId, { handle: result.body.handle });

        return { ok: true, sessionId };
      }

      if (result.error === "invalid_grant") {
        return { ok: false, reason: "invalid_grant", retryable: false };
      }

      if (result.error === "access_denied") {
        return { ok: false, reason: "no_access", retryable: false };
      }

      if (result.error === "invalid_client" || result.error === "invalid_request") {
        return { ok: false, reason: "misconfigured", retryable: false };
      }

      // 503, or anything unexpected: no handle was issued and none may be assumed.
      return { ok: false, reason: "unavailable", retryable: true };
    },

    /**
     * Step 3, before EVERY protected request: ask the portal. Allow only on an explicit
     * `200 { active: true }`. Nothing here is cached, so the next call asks again.
     */
    async authenticate(sessionId: string | undefined, moduleName: string): Promise<Decision> {
      const session = sessionId ? sessions.get(sessionId) : undefined;

      if (!session) {
        return deny("sign_in_required");
      }

      const result = await post("/api/integrations/validate", { handle: session.handle, module: moduleName });

      if (!result) {
        return deny("unavailable");
      }

      if (result.status === 200 && result.body.active === true && typeof result.body.user_id === "string") {
        return { allow: true, userId: result.body.user_id };
      }

      if (result.error === "invalid_handle") {
        // Logged out centrally, expired or revoked: this handle is dead for good.
        sessions.delete(sessionId!);

        return deny("sign_in_required");
      }

      // access_denied keeps the handle: the same sign-in works again if an Administrator
      // restores the User or the Module, with no new login.
      if (result.error === "access_denied") {
        return deny("no_access");
      }

      if (result.error === "invalid_client" || result.error === "invalid_request") {
        return deny("misconfigured");
      }

      return deny("unavailable");
    },
  };
}

export type SystemConsumer = ReturnType<typeof createSystemConsumer>;
