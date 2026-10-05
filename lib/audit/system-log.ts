import "server-only";

import { getPortalUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type SystemLogOutcome = "SUCCESS" | "FAILURE";

/** Actions are stable identifiers; add new ones here as User and AccessGrant mutations start auditing. */
export const SYSTEM_LOG_ACTIONS = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.password_change": "Changed password",
  "auth.password_reset_request": "Requested password reset",
  "auth.password_reset": "Reset password",
} as const;

export type SystemLogAction = keyof typeof SYSTEM_LOG_ACTIONS;

export type SystemLogEventInput = {
  action: SystemLogAction;
  outcome: SystemLogOutcome;
  /** Only set when the actor was authenticated; leave undefined for an unknown identity. */
  actorId?: string | null;
  targetUserId?: string | null;
  /** Short human-readable context. Never pass credentials; common secret shapes are redacted as a backstop. */
  detail?: string | null;
};

const MAX_DETAIL_LENGTH = 200;

function sanitizeDetail(detail: string | null | undefined): string | null {
  if (!detail) {
    return null;
  }

  return detail
    .replace(/bearer\s+\S+/gi, "[redacted]")
    .replace(
      /(password|passwd|token|secret|cookie|code|authorization|session)\s*[=:]\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[redacted]")
    .slice(0, MAX_DETAIL_LENGTH);
}

/**
 * The audit-writing boundary. Append-only, and never throws: a failed audit write
 * must not block a login, logout or password flow.
 */
export async function recordSystemLogEvent(event: SystemLogEventInput): Promise<void> {
  try {
    await prisma.systemLogEvent.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        targetUserId: event.targetUserId ?? null,
        outcome: event.outcome,
        detail: sanitizeDetail(event.detail),
      },
    });
  } catch (error) {
    console.error("Failed to record System Log event", error);
  }
}

export type SystemLogEntry = {
  id: string;
  occurredAt: Date;
  action: string;
  actor: string | null;
  target: string | null;
  outcome: SystemLogOutcome;
  detail: string | null;
};

type NamedUser = { username: string; firstName: string; lastName: string } | null;

function describeUser(user: NamedUser): string | null {
  return user ? `${user.firstName} ${user.lastName} (${user.username})` : null;
}

const LIMIT = 200;

/** Newest first. Checks the live Administrator status itself, so a direct call can't bypass the page guard. */
export async function listSystemLogEvents(): Promise<SystemLogEntry[]> {
  const viewer = await getPortalUser();

  if (!viewer?.isAdministrator) {
    throw new Error("System Logs: Administrators only");
  }

  const userSelect = { username: true, firstName: true, lastName: true };
  const events = await prisma.systemLogEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      occurredAt: true,
      action: true,
      outcome: true,
      detail: true,
      actor: { select: userSelect },
      targetUser: { select: userSelect },
    },
  });

  return events.map((event) => ({
    id: event.id,
    occurredAt: event.occurredAt,
    action: SYSTEM_LOG_ACTIONS[event.action as SystemLogAction] ?? event.action,
    actor: describeUser(event.actor),
    target: describeUser(event.targetUser),
    outcome: event.outcome,
    detail: event.detail,
  }));
}
