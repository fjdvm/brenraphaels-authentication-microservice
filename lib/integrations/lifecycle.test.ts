import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSystemConsumer, type SystemConsumer } from "@/reference/system-consumer/consumer";

import { handleAuthorize, handleExchange, handleValidate } from "./endpoints";
import { checkReturnIntent } from "./return-intent";
import { createWorld } from "./test-support";

const PORTAL = "https://portal.example.com";
const CRMS_CALLBACK = "https://crms.example.com/auth/callback";
const POS_CALLBACK = "https://pos.example.com/cb";

/**
 * The whole contract end to end, from a System backend's side: the reference consumer
 * (reference/system-consumer) talks to the real endpoint handlers over a fetch adapter,
 * and a small browser simulation walks the redirects. Only the provider boundaries
 * (Neon sessions, persistence) are fakes; they are covered against a real database in
 * lifecycle.integration.test.ts.
 */
describe("System lifecycle through the reference consumer", () => {
  let ctx: ReturnType<typeof createWorld>;
  let portalDown: boolean;
  let requestsToPortal: Request[];
  let crms: SystemConsumer;
  let pos: SystemConsumer;

  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "test-secret-test-secret-test-secret-0123");
    ctx = createWorld();
    portalDown = false;
    requestsToPortal = [];

    // CRMS holds two Modules, POS one.
    ctx.world.grants.clear();
    ctx.world.moduleGrants = new Set([
      "user-1:sys-CRMS:Dashboard",
      "user-1:sys-CRMS:Customer Profiles",
      "user-1:sys-POS:Sales",
    ]);

    const portalFetch: typeof fetch = async (input, init) => {
      const request = new Request(input as string, init);
      requestsToPortal.push(request.clone());

      if (portalDown) {
        throw new TypeError("fetch failed");
      }

      const { pathname } = new URL(request.url);

      if (pathname === "/api/integrations/exchange") {
        return handleExchange(request, ctx.deps);
      }

      if (pathname === "/api/integrations/validate") {
        return handleValidate(request, ctx.deps);
      }

      throw new Error(`unexpected backend call to ${pathname}`);
    };

    crms = createSystemConsumer({
      portalUrl: PORTAL,
      systemName: "CRMS",
      backendSecret: ctx.secrets.CRMS,
      callbackUrl: CRMS_CALLBACK,
      fetch: portalFetch,
    });
    pos = createSystemConsumer({
      portalUrl: PORTAL,
      systemName: "POS",
      backendSecret: ctx.secrets.POS,
      callbackUrl: POS_CALLBACK,
      fetch: portalFetch,
    });
  });

  /**
   * What the User's browser does after a System sends it to authorize. With no portal
   * session it goes through central login and resumes; with one it goes straight back.
   */
  async function browserEnters(consumer: SystemConsumer) {
    let response = await handleAuthorize(new Request(consumer.startSignIn().authorizeUrl), ctx.deps);
    let loggedInThisTime = false;

    // A refusal never redirects anywhere, least of all into the System.
    if (!response.headers.get("location")) {
      return { signIn: null, refusedWith: response.status, loggedInThisTime };
    }

    let location = new URL(response.headers.get("location")!, PORTAL);

    if (location.pathname === "/login") {
      const intent = checkReturnIntent(location.searchParams.get("ri"), ctx.world.now);
      expect(intent.status).toBe("valid");

      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" };
      ctx.world.liveSessions.add("neon-session-1");
      loggedInThisTime = true;
      response = await handleAuthorize(
        new Request(new URL(intent.status === "valid" ? intent.authorizePath : "", PORTAL)),
        ctx.deps,
      );
      location = new URL(response.headers.get("location")!, PORTAL);
    }

    return { signIn: await consumer.completeSignIn(location.toString()), refusedWith: null, loggedInThisTime };
  }

  async function signedInTo(consumer: SystemConsumer): Promise<string> {
    const { signIn } = await browserEnters(consumer);

    if (!signIn?.ok) {
      throw new Error("sign-in failed");
    }

    return signIn.sessionId;
  }

  async function setUpSignedOut() {
    ctx.world.subject = { status: "signed_out" };
    ctx.world.liveSessions.clear();
  }

  describe("entry", () => {
    it("direct entry and portal launch share one central session", async () => {
      await setUpSignedOut();

      // Direct entry: the User opened CRMS with no portal session, so central login ran.
      const direct = await browserEnters(crms);
      expect(direct.loggedInThisTime).toBe(true);
      expect(direct.signIn?.ok).toBe(true);

      // Portal launch: the portal card sends them to POS while that session is live.
      const launched = await browserEnters(pos);
      expect(launched.loggedInThisTime).toBe(false);
      expect(launched.signIn?.ok).toBe(true);

      // No second login, and both Systems' handles hang off the one central session.
      expect(ctx.world.sessions.map((session) => session.neonSessionId)).toEqual([
        "neon-session-1",
        "neon-session-1",
      ]);
      expect(ctx.world.sessions.map((session) => session.systemId)).toEqual(["sys-CRMS", "sys-POS"]);

      if (direct.signIn?.ok && launched.signIn?.ok) {
        expect(await crms.authenticate(direct.signIn.sessionId, "Dashboard")).toEqual({
          allow: true,
          userId: "user-1",
        });
        expect(await pos.authenticate(launched.signIn.sessionId, "Sales")).toEqual({
          allow: true,
          userId: "user-1",
        });
      }
    });

    it("never sends the browser's cookies, or anything but the handle and Module, to the portal", async () => {
      const sessionId = await signedInTo(crms);
      await crms.authenticate(sessionId, "Dashboard");

      expect(requestsToPortal.length).toBeGreaterThan(0);

      for (const request of requestsToPortal) {
        expect(request.headers.get("cookie")).toBeNull();
        expect(request.headers.get("authorization")).toMatch(/^Basic /);
      }

      // The browser-facing id is the consumer's own and is not the portal's handle.
      const validation = requestsToPortal.at(-1)!;
      expect(sessionId).not.toBe((await validation.json()).handle);
    });

    it("refuses a callback that was not started by this browser", async () => {
      const result = await crms.completeSignIn(`${CRMS_CALLBACK}?code=anything&state=never-started-0123456789`);

      expect(result).toEqual({ ok: false, reason: "invalid_callback", retryable: false });
    });

    it("spends the sign-in on the first callback, so replaying it gets nothing", async () => {
      const { authorizeUrl } = crms.startSignIn();
      const redirect = await handleAuthorize(new Request(authorizeUrl), ctx.deps);
      const callback = new URL(redirect.headers.get("location")!).toString();

      expect((await crms.completeSignIn(callback)).ok).toBe(true);
      expect(await crms.completeSignIn(callback)).toMatchObject({ ok: false, reason: "invalid_callback" });
    });
  });

  describe("the very next protected request after a change", () => {
    it("is denied after central logout, in every System, and a new login restores access", async () => {
      const crmsSession = await signedInTo(crms);
      const posSession = await signedInTo(pos);
      expect((await crms.authenticate(crmsSession, "Dashboard")).allow).toBe(true);

      ctx.world.liveSessions.delete("neon-session-1");

      for (const [consumer, session, module] of [
        [crms, crmsSession, "Dashboard"],
        [pos, posSession, "Sales"],
      ] as const) {
        expect(await consumer.authenticate(session, module)).toEqual({
          allow: false,
          reason: "sign_in_required",
          retryable: false,
        });
      }

      // Their old handles are dead for good; only a fresh sign-in works.
      ctx.world.liveSessions.add("neon-session-1");
      expect((await crms.authenticate(crmsSession, "Dashboard")).allow).toBe(false);
      expect((await crms.authenticate(await signedInTo(crms), "Dashboard")).allow).toBe(true);
    });

    it("is denied after Module revocation only for that Module, and returns with the retained grant", async () => {
      const session = await signedInTo(crms);

      ctx.world.moduleGrants.delete("user-1:sys-CRMS:Customer Profiles");

      expect(await crms.authenticate(session, "Customer Profiles")).toEqual({
        allow: false,
        reason: "no_access",
        retryable: false,
      });
      expect((await crms.authenticate(session, "Dashboard")).allow).toBe(true);

      // Restoring the same access needs no new login: the handle stayed valid.
      ctx.world.moduleGrants.add("user-1:sys-CRMS:Customer Profiles");

      expect((await crms.authenticate(session, "Customer Profiles")).allow).toBe(true);
    });

    it("is denied after User deletion, and allowed again once the same User is Restored", async () => {
      const session = await signedInTo(crms);

      ctx.world.eligible.delete("user-1");

      expect(await crms.authenticate(session, "Dashboard")).toEqual({
        allow: false,
        reason: "no_access",
        retryable: false,
      });

      ctx.world.eligible.add("user-1");

      expect((await crms.authenticate(session, "Dashboard")).allow).toBe(true);
    });

    it("keeps a revoked User out at sign-in too, with no handle issued", async () => {
      ctx.world.eligible.delete("user-1");

      const entry = await browserEnters(crms);

      expect(entry).toMatchObject({ signIn: null, refusedWith: 403 });
      expect(ctx.world.sessions).toHaveLength(0);
    });
  });

  describe("outages", () => {
    it("deny rather than fall back to the last decision, and are retryable", async () => {
      const session = await signedInTo(crms);
      expect((await crms.authenticate(session, "Dashboard")).allow).toBe(true);

      ctx.world.outage = true;

      expect(await crms.authenticate(session, "Dashboard")).toEqual({
        allow: false,
        reason: "unavailable",
        retryable: true,
      });
    });

    it("treat an unreachable portal the same way", async () => {
      const session = await signedInTo(crms);

      portalDown = true;

      expect(await crms.authenticate(session, "Dashboard")).toEqual({
        allow: false,
        reason: "unavailable",
        retryable: true,
      });
    });

    it("are told apart from invalid access, and the same handle works again afterwards", async () => {
      const session = await signedInTo(crms);

      ctx.world.outage = true;
      const outage = await crms.authenticate(session, "Dashboard");
      ctx.world.outage = false;
      ctx.world.moduleGrants.delete("user-1:sys-CRMS:Dashboard");
      const revoked = await crms.authenticate(session, "Dashboard");

      expect(outage).toMatchObject({ allow: false, retryable: true });
      expect(revoked).toMatchObject({ allow: false, retryable: false });

      ctx.world.moduleGrants.add("user-1:sys-CRMS:Dashboard");

      expect((await crms.authenticate(session, "Dashboard")).allow).toBe(true);
    });

    it("do not create a session during sign-in, and starting again after recovery works", async () => {
      const { authorizeUrl } = crms.startSignIn();
      const redirect = await handleAuthorize(new Request(authorizeUrl), ctx.deps);
      const callback = new URL(redirect.headers.get("location")!).toString();

      ctx.world.outage = true;

      expect(await crms.completeSignIn(callback)).toEqual({ ok: false, reason: "unavailable", retryable: true });
      expect(ctx.world.sessions).toHaveLength(0);

      ctx.world.outage = false;

      expect((await crms.authenticate(await signedInTo(crms), "Dashboard")).allow).toBe(true);
    });
  });

  it("reports a rejected backend secret as a configuration fault, not an access problem", async () => {
    const wrong = createSystemConsumer({
      portalUrl: PORTAL,
      systemName: "CRMS",
      backendSecret: "iss_wrong",
      callbackUrl: CRMS_CALLBACK,
      fetch: async (input, init) => handleExchange(new Request(input as string, init), ctx.deps),
    });
    const redirect = await handleAuthorize(new Request(wrong.startSignIn().authorizeUrl), ctx.deps);

    expect(await wrong.completeSignIn(new URL(redirect.headers.get("location")!).toString())).toEqual({
      ok: false,
      reason: "misconfigured",
      retryable: false,
    });
  });
});
