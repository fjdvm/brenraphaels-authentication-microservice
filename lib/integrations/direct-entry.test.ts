import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleAuthorize } from "./endpoints";
import { HANDOFF_CODE_TTL_MS } from "./handoff";
import { RETURN_INTENT_TTL_MS, checkReturnIntent } from "./return-intent";
import { authorizeUrl, CALLBACK, createWorld, pkcePair, STATE } from "./test-support";

const PORTAL = "https://portal.example.com";

describe("direct System entry through central login", () => {
  let ctx: ReturnType<typeof createWorld>;
  let pkce: ReturnType<typeof pkcePair>;

  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "test-secret-test-secret-test-secret-0123");
    ctx = createWorld();
    pkce = pkcePair();
  });

  function authorize(overrides: Record<string, string | null> = {}, headers: HeadersInit = {}) {
    return handleAuthorize(
      new Request(authorizeUrl(overrides, pkce.challenge), { headers }),
      ctx.deps,
    );
  }

  /** What the login page and actions do with the `ri` the endpoint handed out. */
  function resume(location: string) {
    const url = new URL(location, PORTAL);
    const check = checkReturnIntent(url.searchParams.get("ri"), ctx.world.now);

    expect(check.status).toBe("valid");

    return check.status === "valid" ? check.authorizePath : "";
  }

  function resumeAuthorize(path: string, headers: HeadersInit = {}) {
    return handleAuthorize(new Request(new URL(path, PORTAL), { headers }), ctx.deps);
  }

  describe("signed out", () => {
    beforeEach(() => {
      ctx.world.subject = { status: "signed_out" };
    });

    it("sends the browser to central login carrying the validated request, and issues no code", async () => {
      const response = await authorize();
      const location = new URL(response.headers.get("location")!);

      expect(response.status).toBe(302);
      expect(location.origin).toBe(PORTAL);
      expect(location.pathname).toBe("/login");
      expect(ctx.world.codes).toHaveLength(0);

      const resumed = new URL(resume(location.toString()), PORTAL);

      expect(resumed.pathname).toBe("/api/integrations/authorize");
      expect(resumed.searchParams.get("system")).toBe("CRMS");
      expect(resumed.searchParams.get("redirect_uri")).toBe(CALLBACK);
      expect(resumed.searchParams.get("state")).toBe(STATE);
    });

    it("returns to the original request after login and then hands off with a code", async () => {
      const toLogin = await authorize();
      const resumePath = resume(toLogin.headers.get("location")!);

      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" };
      const resumed = await resumeAuthorize(resumePath);
      const target = new URL(resumed.headers.get("location")!);

      expect(resumed.status).toBe(302);
      expect(`${target.origin}${target.pathname}`).toBe(CALLBACK);
      expect(target.searchParams.get("state")).toBe(STATE);
      expect(target.searchParams.get("code")).toBeTruthy();
      expect(ctx.world.codes).toHaveLength(1);
    });

    it.each([
      ["an unregistered callback", { redirect_uri: "https://evil.example.com/cb" }],
      ["an unknown System", { system: "NOPE" }],
      ["a missing state", { state: null }],
      ["a state that is too short", { state: "short" }],
      ["a missing PKCE challenge", { code_challenge: null }],
      ["a malformed PKCE challenge", { code_challenge: "tooshort" }],
      ["a plain PKCE method", { code_challenge_method: "plain" }],
    ])("refuses %s outright instead of sending it through login", async (_name, overrides) => {
      const response = await authorize(overrides);

      expect(response.status).toBe(400);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.json()).toEqual({ error: "invalid_request" });
    });

    it("explains an invalid request to a browser instead of showing JSON", async () => {
      const response = await authorize(
        { redirect_uri: "https://evil.example.com/cb" },
        { Accept: "text/html,application/xhtml+xml" },
      );
      const html = await response.text();

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("location")).toBeNull();
      expect(html).toMatch(/return to the System and start again/i);
      expect(html).not.toContain("evil.example.com");
    });
  });

  describe("mandatory password change", () => {
    it("keeps the request through the password change and resumes it afterwards", async () => {
      ctx.world.subject = { status: "must_change_password" };

      const toChange = await authorize();
      const location = new URL(toChange.headers.get("location")!);

      expect(toChange.status).toBe(302);
      expect(location.pathname).toBe("/change-password");
      expect(ctx.world.codes).toHaveLength(0);

      const resumePath = resume(location.toString());

      // The User changes their password, so they are now eligible.
      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-2" };
      const resumed = await resumeAuthorize(resumePath);

      expect(new URL(resumed.headers.get("location")!).searchParams.get("code")).toBeTruthy();
      expect(ctx.world.codes[0]).toMatchObject({ neonSessionId: "neon-session-2" });
    });

    it("does not let an invalid request ride the password change either", async () => {
      ctx.world.subject = { status: "must_change_password" };
      const response = await authorize({ redirect_uri: "https://evil.example.com/cb" });

      expect(response.status).toBe(400);
      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("lost access during login", () => {
    async function intentPath() {
      ctx.world.subject = { status: "signed_out" };
      const toLogin = await authorize();

      return resume(toLogin.headers.get("location")!);
    }

    it("denies a User whose System access was removed while they signed in, with no code or redirect", async () => {
      const resumePath = await intentPath();

      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" };
      ctx.world.grants.clear();
      const response = await resumeAuthorize(resumePath);

      expect(response.status).toBe(403);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.json()).toEqual({ error: "access_denied" });
      expect(ctx.world.codes).toHaveLength(0);
    });

    it("shows a clear denial naming the System to a browser", async () => {
      const resumePath = await intentPath();

      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" };
      ctx.world.grants.clear();
      const response = await resumeAuthorize(resumePath, { Accept: "text/html" });
      const html = await response.text();

      expect(response.status).toBe(403);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(html).toContain("CRMS");
      expect(html).toMatch(/don.t have access/i);
      expect(html).toContain('href="/"');
    });

    it("denies a User who was Deleted while they signed in", async () => {
      const resumePath = await intentPath();

      ctx.world.subject = { status: "ineligible" };
      const response = await resumeAuthorize(resumePath);

      expect(response.status).toBe(403);
      expect(response.headers.get("location")).toBeNull();
      expect(ctx.world.codes).toHaveLength(0);
    });
  });

  describe("expiry and replay", () => {
    it("an intent older than its lifetime no longer verifies, so the System must start again", async () => {
      ctx.world.subject = { status: "signed_out" };
      const toLogin = await authorize();
      const token = new URL(toLogin.headers.get("location")!).searchParams.get("ri");

      expect(
        checkReturnIntent(token, new Date(ctx.world.now.getTime() + RETURN_INTENT_TTL_MS + 1)),
      ).toEqual({ status: "expired" });
    });

    it("a restarted request is a fresh authorize that works", async () => {
      ctx.world.subject = { status: "signed_out" };
      await authorize();
      ctx.world.now = new Date(ctx.world.now.getTime() + RETURN_INTENT_TTL_MS + 1);
      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" };

      const response = await authorize();

      expect(new URL(response.headers.get("location")!).searchParams.get("code")).toBeTruthy();
    });

    it("a resumed request still issues a code that is valid only for the standard lifetime", async () => {
      ctx.world.subject = { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" };
      await authorize();

      expect(ctx.world.codes[0].expiresAt.getTime() - ctx.world.now.getTime()).toBe(
        HANDOFF_CODE_TTL_MS,
      );
    });
  });

  it("already-authenticated entry still goes straight to the System", async () => {
    const response = await authorize();
    const target = new URL(response.headers.get("location")!);

    expect(`${target.origin}${target.pathname}`).toBe(CALLBACK);
    expect(target.searchParams.get("code")).toBeTruthy();
  });
});
