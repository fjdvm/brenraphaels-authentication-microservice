import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleAuthorize, handleExchange } from "./endpoints";
import { HANDOFF_CODE_TTL_MS } from "./handoff";
import { authorizeUrl, CALLBACK, createWorld, pkcePair, STATE } from "./test-support";

function exchangeRequest(
  system: string,
  secret: string,
  body: Record<string, unknown>,
): Request {
  return new Request("https://portal.example.com/api/integrations/exchange", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${system}:${secret}`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
}

describe("secure sign-in handoff", () => {
  let ctx: ReturnType<typeof createWorld>;
  let pkce: ReturnType<typeof pkcePair>;

  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "test-secret-test-secret-test-secret-0123");
    ctx = createWorld();
    pkce = pkcePair();
  });

  async function authorize(overrides: Record<string, string | null> = {}) {
    return handleAuthorize(
      new Request(authorizeUrl(overrides, pkce.challenge)),
      ctx.deps,
    );
  }

  async function issueCode(): Promise<string> {
    const response = await authorize();
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);

    expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
    expect(location.searchParams.get("state")).toBe(STATE);

    return location.searchParams.get("code")!;
  }

  function exchange(code: string, overrides: Record<string, unknown> = {}, system = "CRMS") {
    return handleExchange(
      exchangeRequest(system, ctx.secrets[system], {
        code,
        code_verifier: pkce.verifier,
        redirect_uri: CALLBACK,
        state: STATE,
        ...overrides,
      }),
      ctx.deps,
    );
  }

  it("completes a valid signed-in handoff and returns an opaque handle", async () => {
    const code = await issueCode();
    const response = await exchange(code);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ token_type: "opaque", expires_in: expect.any(Number) });
    expect(body.handle).toMatch(/^ish_/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(ctx.world.sessions).toEqual([
      expect.objectContaining({
        systemId: "sys-CRMS",
        userId: "user-1",
        neonSessionId: "neon-session-1",
      }),
    ]);
  });

  it("stores only hashes of the code and the handle", async () => {
    const code = await issueCode();
    const { handle } = await (await exchange(code)).json();
    const stored = JSON.stringify([ctx.world.codes, ctx.world.sessions]);

    expect(stored).not.toContain(code);
    expect(stored).not.toContain(handle);
    expect(JSON.stringify(ctx.world.systems)).not.toContain(ctx.secrets.CRMS);
  });

  it("keeps codes, handles and secrets out of audit events", async () => {
    const code = await issueCode();
    const { handle } = await (await exchange(code)).json();
    await exchange(code); // replay, a failure event
    const audit = JSON.stringify(ctx.world.audit);

    expect(audit).not.toContain(code);
    expect(audit).not.toContain(handle);
    expect(audit).not.toContain(ctx.secrets.CRMS);
    expect(ctx.world.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "integration.authorize", outcome: "SUCCESS" }),
        expect.objectContaining({ action: "integration.exchange", outcome: "SUCCESS" }),
        expect.objectContaining({ action: "integration.exchange", outcome: "FAILURE" }),
      ]),
    );
  });

  describe("authorization is refused", () => {
    it("for a callback that was not registered, without redirecting", async () => {
      const response = await authorize({ redirect_uri: "https://evil.example.com/callback" });

      expect(response.status).toBe(400);
      expect(response.headers.get("location")).toBeNull();
      expect(ctx.world.codes).toHaveLength(0);
    });

    it("for a callback that only resembles a registered one", async () => {
      for (const redirect_uri of [`${CALLBACK}/`, `${CALLBACK}?next=x`, CALLBACK.toUpperCase()]) {
        expect((await authorize({ redirect_uri })).status).toBe(400);
      }
    });

    it("for an unknown System", async () => {
      expect((await authorize({ system: "ERP" })).status).toBe(400);
    });

    it("for a System with no registered backend secret", async () => {
      ctx.world.systems[0] = { ...ctx.world.systems[0], backendSecretHash: null };

      expect((await authorize()).status).toBe(400);
    });

    it("without PKCE or correlation", async () => {
      expect((await authorize({ code_challenge: null })).status).toBe(400);
      expect((await authorize({ code_challenge_method: "plain" })).status).toBe(400);
      expect((await authorize({ state: null })).status).toBe(400);
      expect((await authorize({ state: "short" })).status).toBe(400);
    });

    it("for a User with no active Module grant in the requested System", async () => {
      ctx.world.grants.clear();

      const response = await authorize();

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "access_denied" });
      expect(ctx.world.codes).toHaveLength(0);
    });

    it("for a grant held only in a different System", async () => {
      expect((await authorize({ system: "POS", redirect_uri: "https://pos.example.com/cb" })).status).toBe(403);
    });

    it("for an ineligible User", async () => {
      ctx.world.subject = { status: "ineligible" };

      expect((await authorize()).status).toBe(403);
    });

    it("by sending a visitor with no valid session to central login", async () => {
      ctx.world.subject = { status: "signed_out" };
      const response = await authorize();

      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
      expect(ctx.world.codes).toHaveLength(0);
    });

    it("by sending a User with a Temporary password to change it first", async () => {
      ctx.world.subject = { status: "must_change_password" };
      const response = await authorize();

      expect(new URL(response.headers.get("location")!).pathname).toBe("/change-password");
      expect(ctx.world.codes).toHaveLength(0);
    });
  });

  it("answers temporarily_unavailable, not a stack trace, when authorization cannot be decided", async () => {
    ctx.deps.ports.hasActiveGrantInSystem = async () => {
      throw new Error("db down");
    };

    const response = await authorize();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
    expect(ctx.world.codes).toHaveLength(0);
  });

  describe("code exchange is refused", () => {
    it("for a replayed code", async () => {
      const code = await issueCode();

      expect((await exchange(code)).status).toBe(200);

      const replay = await exchange(code);

      expect(replay.status).toBe(400);
      expect(await replay.json()).toEqual({ error: "invalid_grant" });
      expect(ctx.world.sessions).toHaveLength(1);
    });

    it("for concurrent reuse: exactly one exchange wins", async () => {
      const code = await issueCode();
      const responses = await Promise.all(Array.from({ length: 8 }, () => exchange(code)));
      const statuses = responses.map((response) => response.status).sort();

      expect(statuses.filter((status) => status === 200)).toHaveLength(1);
      expect(statuses.filter((status) => status === 400)).toHaveLength(7);
      expect(ctx.world.sessions).toHaveLength(1);
    });

    it("for an expired code", async () => {
      const code = await issueCode();
      ctx.world.now = new Date(ctx.world.now.getTime() + HANDOFF_CODE_TTL_MS + 1);

      const response = await exchange(code);

      expect(response.status).toBe(400);
      expect(ctx.world.sessions).toHaveLength(0);
    });

    it("from a different System, without burning the owner's code", async () => {
      const code = await issueCode();
      const wrong = await exchange(code, { redirect_uri: "https://pos.example.com/cb" }, "POS");

      expect(wrong.status).toBe(400);
      expect((await exchange(code)).status).toBe(200);
    });

    it("with invalid backend authentication", async () => {
      const code = await issueCode();
      const bad = await handleExchange(
        exchangeRequest("CRMS", "iss_not-the-secret", {
          code,
          code_verifier: pkce.verifier,
          redirect_uri: CALLBACK,
          state: STATE,
        }),
        ctx.deps,
      );
      const anonymous = await handleExchange(
        new Request("https://portal.example.com/api/integrations/exchange", {
          method: "POST",
          body: JSON.stringify({ code }),
        }),
        ctx.deps,
      );
      const otherSystemsSecret = await handleExchange(
        exchangeRequest("CRMS", ctx.secrets.POS, {
          code,
          code_verifier: pkce.verifier,
          redirect_uri: CALLBACK,
          state: STATE,
        }),
        ctx.deps,
      );

      for (const response of [bad, anonymous, otherSystemsSecret]) {
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "invalid_client" });
      }
      // None of the failed attempts consumed the code.
      expect((await exchange(code)).status).toBe(200);
    });

    it("for tampered correlation or proof, and the code is then dead", async () => {
      const tampering: Record<string, unknown>[] = [
        { state: `${STATE}-tampered` },
        { redirect_uri: `${CALLBACK}/other` },
        { code_verifier: pkcePair().verifier },
        { code_verifier: "too-short" },
      ];

      for (const tamper of tampering) {
        const code = await issueCode();
        const response = await exchange(code, tamper);

        expect(response.status).toBe(400);
        expect((await exchange(code)).status).toBe(400);
      }

      expect(ctx.world.sessions).toHaveLength(0);
    });

    it("for a missing field", async () => {
      const code = await issueCode();

      expect((await exchange(code, { state: undefined })).status).toBe(400);
    });

    it("once the User has lost the Module grant", async () => {
      const code = await issueCode();
      ctx.world.grants.clear();

      expect((await exchange(code)).status).toBe(403);
      expect(ctx.world.sessions).toHaveLength(0);
    });

    it("once the User is no longer eligible", async () => {
      const code = await issueCode();
      ctx.world.eligible.clear();

      expect((await exchange(code)).status).toBe(403);
    });

    it("once the original central session has ended", async () => {
      const code = await issueCode();
      ctx.world.liveSessions.clear();

      expect((await exchange(code)).status).toBe(400);
      expect(ctx.world.sessions).toHaveLength(0);
    });

    it("with no positive result when the portal cannot reach its stores", async () => {
      const code = await issueCode();
      ctx.deps.ports.isCentralSessionActive = async () => {
        throw new Error("neon unreachable");
      };

      const response = await exchange(code);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
      expect(ctx.world.sessions).toHaveLength(0);
    });
  });
});
