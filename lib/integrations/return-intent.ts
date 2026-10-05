import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// A System's authorize request that reached the portal without a valid session has to
// survive central login and, for a new User, the mandatory password change. The request
// is already validated when it is issued here; it then travels in the URL (and a hidden
// field) as a signed, short-lived token. Resuming never follows a destination taken from
// the URL: the only place a verified intent can send the browser is the portal's own
// authorize endpoint, which re-validates everything and re-checks the User's access.

export const RETURN_INTENT_PARAM = "ri";
export const RETURN_INTENT_TTL_MS = 15 * 60 * 1000;

const AUTHORIZE_PATH = "/api/integrations/authorize";

export type ReturnRequest = {
  system: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
};

export type ReturnIntentCheck =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "valid"; authorizePath: string; systemName: string };

function sign(body: string): Buffer {
  return createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET!)
    .update(`system-return:${body}`)
    .digest();
}

/** Signs a request that has already passed authorize validation. */
export function issueReturnIntent(request: ReturnRequest, now: Date = new Date()): string {
  const body = Buffer.from(
    JSON.stringify({
      s: request.system,
      r: request.redirectUri,
      t: request.state,
      c: request.codeChallenge,
      x: now.getTime() + RETURN_INTENT_TTL_MS,
    }),
  ).toString("base64url");

  return `${body}.${sign(body).toString("base64url")}`;
}

function readPayload(body: string): (ReturnRequest & { expiresAt: number }) | null {
  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const { s, r, t, c, x } = (payload ?? {}) as Record<string, unknown>;

  if (
    typeof s !== "string" ||
    typeof r !== "string" ||
    typeof t !== "string" ||
    typeof c !== "string" ||
    typeof x !== "number"
  ) {
    return null;
  }

  return { system: s, redirectUri: r, state: t, codeChallenge: c, expiresAt: x };
}

/** Verifies a token and, if good, rebuilds the authorize path to resume. */
export function checkReturnIntent(
  token: string | null | undefined,
  now: Date = new Date(),
): ReturnIntentCheck {
  if (!token) {
    return { status: "none" };
  }

  const parts = token.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { status: "invalid" };
  }

  const [body, signature] = parts;
  const expected = sign(body);
  const received = Buffer.from(signature, "base64url");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { status: "invalid" };
  }

  const payload = readPayload(body);

  if (!payload) {
    return { status: "invalid" };
  }

  if (now.getTime() > payload.expiresAt) {
    return { status: "expired" };
  }

  const query = new URLSearchParams({
    system: payload.system,
    redirect_uri: payload.redirectUri,
    state: payload.state,
    code_challenge: payload.codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    status: "valid",
    authorizePath: `${AUTHORIZE_PATH}?${query.toString()}`,
    systemName: payload.system,
  };
}

/** `/login` or `/change-password`, carrying the intent when there is one. */
export function withReturnIntent(path: string, token: string | null | undefined): string {
  return token ? `${path}?${RETURN_INTENT_PARAM}=${encodeURIComponent(token)}` : path;
}

export type ReturnIntentProblem = "expired" | "invalid";

export type ReturnIntentView = {
  /** The token to carry forward; null unless it verified. */
  token: string | null;
  authorizePath: string | null;
  systemName: string | null;
  /** Set when a request was presented but can't be resumed, so the page can say so. */
  problem: ReturnIntentProblem | null;
};

/** What a login or password-change page needs from its `ri` search parameter. */
export function viewReturnIntent(
  param: string | string[] | undefined,
  now: Date = new Date(),
): ReturnIntentView {
  const token = Array.isArray(param) ? param[0] : param;
  const check = checkReturnIntent(token, now);

  if (check.status === "valid") {
    return {
      token: token!,
      authorizePath: check.authorizePath,
      systemName: check.systemName,
      problem: null,
    };
  }

  return {
    token: null,
    authorizePath: null,
    systemName: null,
    problem: check.status === "none" ? null : check.status,
  };
}
