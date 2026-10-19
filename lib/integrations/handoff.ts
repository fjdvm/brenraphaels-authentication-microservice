import { isCallbackAllowed } from "./callbacks";
import { generateToken, hashToken, isValidCodeChallenge, safeEqual, verifyPkce } from "./tokens";

export const HANDOFF_CODE_TTL_MS = 60_000;
export const INTEGRATION_HANDLE_TTL_MS = 8 * 60 * 60 * 1000;
export const INTEGRATION_HANDLE_PREFIX = "ish_";

const STATE_PATTERN = /^[\x21-\x7e]{16,256}$/;

export type RegisteredSystem = {
  id: string;
  name: string;
  callbackUrls: string[];
  backendSecretHash: string | null;
};

export type HandoffCodeRecord = {
  codeHash: string;
  systemId: string;
  userId: string;
  neonSessionId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  expiresAt: Date;
};

export type IntegrationSessionRecord = {
  handleHash: string;
  systemId: string;
  userId: string;
  neonSessionId: string;
  expiresAt: Date;
};

/** Everything the handoff needs from persistence and Neon Auth; faked at this seam in tests. */
export type HandoffPorts = {
  findSystemByName(name: string): Promise<RegisteredSystem | null>;
  /** True only for a non-Deleted User who has already replaced their Temporary password. */
  isUserEligible(userId: string): Promise<boolean>;
  /** True when the User holds at least one active Module AccessGrant in the System. */
  hasActiveGrantInSystem(userId: string, systemId: string): Promise<boolean>;
  /** Fresh (uncached) check that the original central session still exists and is unexpired. */
  isCentralSessionActive(neonSessionId: string, now: Date): Promise<boolean>;
  saveCode(record: HandoffCodeRecord): Promise<void>;
  /**
   * Atomically marks the unexpired, unconsumed code for this System as consumed and
   * returns it. Exactly one concurrent caller can ever receive a record.
   */
  consumeCode(codeHash: string, systemId: string, now: Date): Promise<HandoffCodeRecord | null>;
  saveSession(record: IntegrationSessionRecord): Promise<void>;
  now(): Date;
};

export type HandoffErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "access_denied"
  | "temporarily_unavailable";

export type HandoffFailure = { ok: false; error: HandoffErrorCode; status: number };

const STATUS: Record<HandoffErrorCode, number> = {
  invalid_request: 400,
  invalid_grant: 400,
  invalid_client: 401,
  access_denied: 403,
  temporarily_unavailable: 503,
};

export function handoffFailure(error: HandoffErrorCode): HandoffFailure {
  return { ok: false, error, status: STATUS[error] };
}

export type AuthorizeParams = {
  system: string | null;
  redirectUri: string | null;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
};

export type AuthorizeRequest = AuthorizeParams & {
  /** The signed-in browser session, already freshly validated by the caller. */
  subject: { userId: string; neonSessionId: string };
};

export type AuthorizeResult =
  | { ok: true; redirectTo: string; system: RegisteredSystem }
  | (HandoffFailure & { system?: RegisteredSystem });

export type ValidatedAuthorizeParams =
  | { ok: true; system: RegisteredSystem; redirectUri: string; state: string; codeChallenge: string }
  | (HandoffFailure & { system?: RegisteredSystem });

/**
 * Checks everything about an authorize request that does not depend on who the User is:
 * a registered System, an exactly registered callback, a well-formed state and PKCE
 * challenge. Needs no session, so a request can be vetted before login and kept.
 */
export async function validateAuthorizeParams(
  ports: HandoffPorts,
  params: AuthorizeParams,
): Promise<ValidatedAuthorizeParams> {
  const { system: systemName, redirectUri, state, codeChallenge, codeChallengeMethod } = params;

  if (!systemName || !redirectUri || !state || !codeChallenge) {
    return handoffFailure("invalid_request");
  }

  const system = await ports.findSystemByName(systemName);

  // An unknown System and an unregistered callback are indistinguishable on purpose,
  // and neither is ever redirected to.
  if (!system || !system.backendSecretHash || !system.callbackUrls.includes(redirectUri) || !isCallbackAllowed(redirectUri)) {
    return handoffFailure("invalid_request");
  }

  if (
    codeChallengeMethod !== "S256" ||
    !isValidCodeChallenge(codeChallenge) ||
    !STATE_PATTERN.test(state)
  ) {
    return { ...handoffFailure("invalid_request"), system };
  }

  return { ok: true, system, redirectUri, state, codeChallenge };
}

/** Issues a short-lived single-use code for a registered System, or refuses. */
export async function authorizeHandoff(
  ports: HandoffPorts,
  request: AuthorizeRequest,
): Promise<AuthorizeResult> {
  const { subject, ...params } = request;
  const validated = await validateAuthorizeParams(ports, params);

  if (!validated.ok) {
    return validated;
  }

  const { system, redirectUri, state, codeChallenge } = validated;

  if (
    !(await ports.isUserEligible(subject.userId)) ||
    !(await ports.hasActiveGrantInSystem(subject.userId, system.id))
  ) {
    return { ...handoffFailure("access_denied"), system };
  }

  const code = generateToken();
  await ports.saveCode({
    codeHash: hashToken(code),
    systemId: system.id,
    userId: subject.userId,
    neonSessionId: subject.neonSessionId,
    redirectUri,
    state,
    codeChallenge,
    expiresAt: new Date(ports.now().getTime() + HANDOFF_CODE_TTL_MS),
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  target.searchParams.set("state", state);

  return { ok: true, redirectTo: target.toString(), system };
}

export type ExchangeRequest = {
  /** Backend credentials from the Authorization header. */
  systemName: string | null;
  secret: string | null;
  code: string | null;
  codeVerifier: string | null;
  redirectUri: string | null;
  state: string | null;
};

export type ExchangeResult =
  | { ok: true; handle: string; expiresIn: number; system: RegisteredSystem; userId: string }
  | (HandoffFailure & { system?: RegisteredSystem });

/** Exchanges a code for an opaque System-bound handle. Every refusal leaves the code unusable. */
export async function exchangeCode(
  ports: HandoffPorts,
  request: ExchangeRequest,
): Promise<ExchangeResult> {
  const system = request.systemName ? await ports.findSystemByName(request.systemName) : null;

  if (
    !system ||
    !system.backendSecretHash ||
    !request.secret ||
    !safeEqual(hashToken(request.secret), system.backendSecretHash)
  ) {
    return handoffFailure("invalid_client");
  }

  if (!request.code || !request.codeVerifier || !request.redirectUri || !request.state) {
    return { ...handoffFailure("invalid_request"), system };
  }

  const now = ports.now();
  // Consume first, verify after: one atomic claim, so a replay or a concurrent twin
  // finds nothing, and a bad proof burns the code instead of letting it be guessed at.
  // Scoped to the authenticated System, so another System cannot burn this one's code.
  const code = await ports.consumeCode(hashToken(request.code), system.id, now);

  if (
    !code ||
    !safeEqual(code.redirectUri, request.redirectUri) ||
    !safeEqual(code.state, request.state) ||
    !verifyPkce(request.codeVerifier, code.codeChallenge)
  ) {
    return { ...handoffFailure("invalid_grant"), system };
  }

  if (!(await ports.isCentralSessionActive(code.neonSessionId, now))) {
    return { ...handoffFailure("invalid_grant"), system };
  }

  if (
    !(await ports.isUserEligible(code.userId)) ||
    !(await ports.hasActiveGrantInSystem(code.userId, system.id))
  ) {
    return { ...handoffFailure("access_denied"), system };
  }

  const handle = generateToken(INTEGRATION_HANDLE_PREFIX);
  await ports.saveSession({
    handleHash: hashToken(handle),
    systemId: system.id,
    userId: code.userId,
    neonSessionId: code.neonSessionId,
    expiresAt: new Date(now.getTime() + INTEGRATION_HANDLE_TTL_MS),
  });

  return {
    ok: true,
    handle,
    expiresIn: INTEGRATION_HANDLE_TTL_MS / 1000,
    system,
    userId: code.userId,
  };
}
