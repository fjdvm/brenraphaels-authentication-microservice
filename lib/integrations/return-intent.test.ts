import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  RETURN_INTENT_TTL_MS,
  checkReturnIntent,
  issueReturnIntent,
  viewReturnIntent,
  type ReturnRequest,
} from "./return-intent";

const SECRET = "test-secret-test-secret-test-secret-0123";
const NOW = new Date("2026-10-07T10:00:00Z");

const request: ReturnRequest = {
  system: "CRMS",
  redirectUri: "https://crms.example.com/auth/callback",
  state: "correlation-state-0123456789",
  codeChallenge: "a".repeat(43),
};

function forge(payload: unknown, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`system-return:${body}`).digest("base64url");

  return `${body}.${signature}`;
}

describe("return intent", () => {
  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", SECRET);
  });

  it("round-trips into the authorize path for exactly the original request", () => {
    const check = checkReturnIntent(issueReturnIntent(request, NOW), NOW);

    expect(check.status).toBe("valid");

    if (check.status !== "valid") return;

    const target = new URL(check.authorizePath, "https://portal.example.com");

    expect(target.pathname).toBe("/api/integrations/authorize");
    expect(Object.fromEntries(target.searchParams)).toEqual({
      system: "CRMS",
      redirect_uri: request.redirectUri,
      state: request.state,
      code_challenge: request.codeChallenge,
      code_challenge_method: "S256",
    });
    expect(check.systemName).toBe("CRMS");
  });

  it("only ever produces a same-origin relative path", () => {
    const check = checkReturnIntent(
      issueReturnIntent({ ...request, redirectUri: "https://evil.example.com/steal" }, NOW),
      NOW,
    );

    expect(check.status).toBe("valid");

    if (check.status !== "valid") return;

    // The destination is a fixed path; the callback is only data inside the query.
    expect(check.authorizePath.startsWith("/api/integrations/authorize?")).toBe(true);
    expect(check.authorizePath.startsWith("//")).toBe(false);
  });

  it("reports nothing to resume when there is no intent", () => {
    expect(checkReturnIntent(undefined, NOW)).toEqual({ status: "none" });
    expect(checkReturnIntent(null, NOW)).toEqual({ status: "none" });
    expect(checkReturnIntent("", NOW)).toEqual({ status: "none" });
  });

  it("rejects a token whose payload was tampered with", () => {
    const [, signature] = issueReturnIntent(request, NOW).split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ s: "CRMS", r: "https://evil.example.com/", t: request.state, c: request.codeChallenge, x: NOW.getTime() + 1000 }),
    ).toString("base64url");

    expect(checkReturnIntent(`${tamperedBody}.${signature}`, NOW)).toEqual({ status: "invalid" });
  });

  it("rejects a token signed with another secret", () => {
    const token = forge(
      { s: "CRMS", r: request.redirectUri, t: request.state, c: request.codeChallenge, x: NOW.getTime() + 1000 },
      "another-secret-another-secret-another-1",
    );

    expect(checkReturnIntent(token, NOW)).toEqual({ status: "invalid" });
  });

  it.each(["garbage", "a.b.c", ".", "abc.", ".abc", "https://evil.example.com", "//evil.example.com"])(
    "rejects malformed input %j",
    (value) => {
      expect(checkReturnIntent(value, NOW)).toEqual({ status: "invalid" });
    },
  );

  it("rejects a correctly signed token with a malformed payload", () => {
    expect(checkReturnIntent(forge({ s: 1 }), NOW)).toEqual({ status: "invalid" });
    expect(checkReturnIntent(forge("not an object"), NOW)).toEqual({ status: "invalid" });
  });

  it("expires after its lifetime, distinguishably from tampering", () => {
    const token = issueReturnIntent(request, NOW);

    expect(checkReturnIntent(token, new Date(NOW.getTime() + RETURN_INTENT_TTL_MS - 1)).status).toBe("valid");
    expect(checkReturnIntent(token, new Date(NOW.getTime() + RETURN_INTENT_TTL_MS + 1))).toEqual({
      status: "expired",
    });
  });
});

describe("viewReturnIntent", () => {
  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", SECRET);
  });

  it("exposes a good intent, taking the first value of a repeated parameter", () => {
    const token = issueReturnIntent(request, NOW);
    const view = viewReturnIntent([token, "ignored"], NOW);

    expect(view).toMatchObject({ token, systemName: "CRMS", problem: null });
    expect(view.authorizePath).toContain("/api/integrations/authorize?");
  });

  it("says nothing when there is no intent", () => {
    expect(viewReturnIntent(undefined, NOW)).toEqual({
      token: null,
      authorizePath: null,
      systemName: null,
      problem: null,
    });
  });

  it("flags an expired or invalid intent and never exposes its token", () => {
    const token = issueReturnIntent(request, NOW);

    expect(viewReturnIntent(token, new Date(NOW.getTime() + RETURN_INTENT_TTL_MS + 1))).toEqual({
      token: null,
      authorizePath: null,
      systemName: null,
      problem: "expired",
    });
    expect(viewReturnIntent("//evil.example.com", NOW)).toMatchObject({
      token: null,
      problem: "invalid",
    });
  });
});
