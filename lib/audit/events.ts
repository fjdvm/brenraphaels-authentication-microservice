export type AuditOutcome = "SUCCESS" | "FAILURE";

/** Portal-side action identifiers; `audit-logs.ts` maps each to the service's Authentication catalog. */
export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "auth.password_change",
  "auth.password_reset_request",
  "auth.password_reset",
  "user.create",
  "user.delete",
  "user.restore",
  "user.resend_credentials",
  "user.role_change",
  "user.access_update",
  "access.grant",
  "access.revoke",
  "integration.authorize",
  "integration.exchange",
  "integration.validate",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEventInput = {
  action: AuditAction;
  outcome: AuditOutcome;
  /** Only set when the actor was authenticated; leave undefined for an unknown identity. */
  actorId?: string | null;
  targetUserId?: string | null;
  /** Short human-readable context. Never pass credentials; common secret shapes are redacted as a backstop. */
  detail?: string | null;
};
