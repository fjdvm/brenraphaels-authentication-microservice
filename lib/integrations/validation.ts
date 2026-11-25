import { canReadShopSettings } from "@/lib/auth/role-authority";
import { hashToken, safeEqual } from "./tokens";
import type { HandoffPorts, IntegrationSessionRecord } from "./handoff";

export type StaffProfile = { name: string; username: string; email: string; role: string };

export type StoredIntegrationSession = IntegrationSessionRecord & { revokedAt: Date | null };

/** Everything live validation needs; faked at this seam in tests. */
export type ValidationPorts = Pick<
  HandoffPorts,
  "findSystemByName" | "isUserEligible" | "isCentralSessionActive" | "now"
> & {
  findIntegrationSession(handleHash: string): Promise<StoredIntegrationSession | null>;
  /** True when the User holds an unrevoked AccessGrant on the named Module of this System. */
  hasActiveGrantInModule(userId: string, systemId: string, moduleName: string): Promise<boolean>;
  /** Display details of the User, read fresh so a renamed or re-roled User is shown correctly. */
  findStaffProfile(userId: string): Promise<StaffProfile | null>;
};

export type ValidationErrorCode =
  | "invalid_client"
  | "invalid_request"
  | "invalid_handle"
  | "access_denied"
  | "temporarily_unavailable";

export type ValidationFailure = {
  ok: false;
  error: ValidationErrorCode;
  status: number;
  system?: { id: string; name: string };
  userId?: string;
};

const STATUS: Record<ValidationErrorCode, number> = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_handle: 401,
  access_denied: 403,
  temporarily_unavailable: 503,
};

export function validationFailure(error: ValidationErrorCode): ValidationFailure {
  return { ok: false, error, status: STATUS[error] };
}

export type ValidationRequest = {
  systemName: string | null;
  secret: string | null;
  handle: string | null;
  moduleName: string | null;
};

export type ValidationResult =
  | { ok: true; userId: string; system: string; module: string; staff: StaffProfile }
  | ValidationFailure;

/**
 * Decides, from current central truth, whether the User behind a handle may make the
 * next protected request to one Module of the calling System. Nothing is cached or
 * remembered between calls: the session row, the User and the AccessGrant are read
 * every time. Any thrown port error propagates so the caller can answer "unavailable"
 * rather than a decision.
 */
export async function validateAccess(
  ports: ValidationPorts,
  request: ValidationRequest,
): Promise<ValidationResult> {
  const system = request.systemName ? await ports.findSystemByName(request.systemName) : null;

  if (
    !system ||
    !system.backendSecretHash ||
    !request.secret ||
    !safeEqual(hashToken(request.secret), system.backendSecretHash)
  ) {
    return validationFailure("invalid_client");
  }

  const identified = { id: system.id, name: system.name };

  if (!request.handle || !request.moduleName) {
    return { ...validationFailure("invalid_request"), system: identified };
  }

  const now = ports.now();
  const session = await ports.findIntegrationSession(hashToken(request.handle));

  // An unknown handle and another System's handle are indistinguishable on purpose.
  if (
    !session ||
    session.systemId !== system.id ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    !(await ports.isCentralSessionActive(session.neonSessionId, now))
  ) {
    return { ...validationFailure("invalid_handle"), system: identified };
  }

  const settings = system.name === "CRMS" && request.moduleName === "Portal Settings";
  const staff = settings ? await ports.findStaffProfile(session.userId) : null;
  const settingsRole = staff && canReadShopSettings(staff.role);
  if (
    !(await ports.isUserEligible(session.userId)) ||
    (settings ? !settingsRole : !(await ports.hasActiveGrantInModule(session.userId, system.id, request.moduleName)))
  ) {
    return { ...validationFailure("access_denied"), system: identified, userId: session.userId };
  }

  const profile = staff ?? await ports.findStaffProfile(session.userId);

  if (!profile) {
    return { ...validationFailure("access_denied"), system: identified, userId: session.userId };
  }

  return { ok: true, userId: session.userId, system: system.name, module: request.moduleName, staff: profile };
}

export type SystemsPorts = Pick<ValidationPorts, "findSystemByName" | "isUserEligible" | "isCentralSessionActive" | "findIntegrationSession" | "now"> & {
  /** Names of the Systems where the User holds an unrevoked AccessGrant on an unretired Module. */
  listSystemNamesWithGrants(userId: string): Promise<string[]>;
};

export type SystemsResult = { ok: true; systems: string[] } | ValidationFailure;

/**
 * Which Systems the User behind a handle may enter, from current central truth, so a
 * System's switcher shows only what an Admin granted. Same credential and handle rules
 * as validateAccess; nothing is cached.
 */
export async function listAccessibleSystems(
  ports: SystemsPorts,
  request: { systemName: string | null; secret: string | null; handle: string | null },
): Promise<SystemsResult> {
  const system = request.systemName ? await ports.findSystemByName(request.systemName) : null;

  if (
    !system ||
    !system.backendSecretHash ||
    !request.secret ||
    !safeEqual(hashToken(request.secret), system.backendSecretHash)
  ) {
    return validationFailure("invalid_client");
  }

  const identified = { id: system.id, name: system.name };

  if (!request.handle) {
    return { ...validationFailure("invalid_request"), system: identified };
  }

  const now = ports.now();
  const session = await ports.findIntegrationSession(hashToken(request.handle));

  if (
    !session ||
    session.systemId !== system.id ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    !(await ports.isCentralSessionActive(session.neonSessionId, now))
  ) {
    return { ...validationFailure("invalid_handle"), system: identified };
  }

  if (!(await ports.isUserEligible(session.userId))) {
    return { ...validationFailure("access_denied"), system: identified, userId: session.userId };
  }

  return { ok: true, systems: await ports.listSystemNamesWithGrants(session.userId) };
}
