import type { AuditAction, AuditEventInput, AuditOutcome } from "./events";

/** Resolves User ids to the display name captured on the event, e.g. "Ada Min (2026-ADMIN-001)". */
export type UserDirectory = (ids: string[]) => Promise<Map<string, string>>;

export type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

/** A row of the System logs page. */
export type AuditLogEntry = {
  id: string;
  occurredAt: Date;
  /** The Source as the Portal labels it: Authentication shows as "Portal". */
  system: string;
  action: string;
  actor: string;
  target: string;
  outcome: AuditOutcome;
  description: string;
};

export type AuditClient = {
  /** Best effort and never throws: a failed audit write must not block any flow. */
  record(event: AuditEventInput, context?: RequestContext): Promise<void>;
  /** Newest first, across every Source. Rejects when the service cannot be read. */
  listNewest(limit: number): Promise<AuditLogEntry[]>;
};

type ClientConfig = {
  baseUrl: string;
  /** The Portal's `write:Authentication` key. Server-side only. */
  writeKey: string;
  /** A `read:admin` key. Server-side only. */
  readKey: string;
  users: UserDirectory;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

type ServiceEvent = {
  id: string;
  source: string;
  action: string;
  outcome: "success" | "failure";
  actor?: { display_name?: string };
  target?: { display_name?: string };
  description?: string;
  occurred_at: string;
};

const SOURCE = "Authentication";
const DEFAULT_TIMEOUT_MS = 2000;

/** Portal actions as the Authentication catalog names them, with the wording for the page and descriptions. */
const CATALOG: Record<AuditAction, { action: string; label: string }> = {
  "auth.login": { action: "user.login", label: "Signed in" },
  "auth.logout": { action: "user.logout", label: "Signed out" },
  "auth.password_change": { action: "password.changed", label: "Changed password" },
  "auth.password_reset_request": { action: "password.forgot_requested", label: "Requested Forgot password link" },
  "auth.password_reset": { action: "password.forgot_completed", label: "Completed Forgot password" },
  "user.create": { action: "user.created", label: "Created User" },
  "user.delete": { action: "user.deleted", label: "Deleted User" },
  "user.restore": { action: "user.restored", label: "Restored User" },
  "user.resend_credentials": { action: "credentials.resent", label: "Resent credentials" },
  "user.role_change": { action: "user.role_changed", label: "Changed User Role" },
  // The catalog has no "access update" action; a failed save is filed under the grant it was attempting.
  "user.access_update": { action: "access_grant.granted", label: "Updated User access" },
  "access.grant": { action: "access_grant.granted", label: "Granted Module access" },
  "access.revoke": { action: "access_grant.revoked", label: "Revoked Module access" },
  "integration.authorize": { action: "system.handoff_authorized", label: "Authorized a System sign-in" },
  "integration.exchange": { action: "system.handoff_exchanged", label: "Exchanged a System sign-in code" },
  "integration.validate": { action: "system.handoff_denied", label: "Denied a System request" },
};

const ACTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.values(CATALOG).map(({ action, label }) => [action, label])),
  "user.login_failed": "Failed sign-in",
};

const ANONYMOUS_ACTOR = { type: "anonymous", id: "unauthenticated", display_name: "Unauthenticated visitor" };
const PORTAL_TARGET = { type: "portal", id: "portal", display_name: "Portal" };

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

function catalogAction(event: AuditEventInput): string {
  return event.action === "auth.login" && event.outcome === "FAILURE"
    ? "user.login_failed"
    : CATALOG[event.action].action;
}

function describe(event: AuditEventInput, actor: string, target: string | null): string {
  const label = ACTION_LABELS[catalogAction(event)];
  const onUser = target && target !== actor ? ` ${target}` : "";
  const detail = sanitizeDetail(event.detail);
  const failed = event.outcome === "FAILURE" ? " (failed)" : "";

  return `${actor}: ${label}${onUser}${failed}${detail ? ` - ${detail}` : ""}.`;
}

async function describeUsers(users: UserDirectory, ids: string[], timeoutMs: number): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }

  try {
    // A slow lookup must not hold up the flow being audited; fall back to the ids instead.
    return await Promise.race([
      users(ids),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("User lookup timed out")), timeoutMs)),
    ]);
  } catch (error) {
    console.error("Audit: could not resolve User names", error);
    return new Map();
  }
}

export function createAuditClient(config: ClientConfig): AuditClient {
  const base = config.baseUrl.replace(/\/+$/, "");
  const doFetch = config.fetch ?? fetch;

  const send = (path: string, init: RequestInit & { key: string }) => {
    const { key, ...rest } = init;

    return doFetch(`${base}${path}`, {
      ...rest,
      headers: { Authorization: `Bearer ${key}`, ...(rest.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  };

  async function post(body: string): Promise<void> {
    // Network errors, timeouts, throttling and server errors are worth one more try; a rejected event is not.
    const retryable = (response: Response) => response.status === 429 || response.status >= 500;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let response: Response;

      try {
        response = await send("/events", { method: "POST", body, key: config.writeKey });
      } catch (error) {
        if (attempt === 2) throw error;
        continue;
      }

      if (response.ok) {
        return;
      }

      if (attempt === 2 || !retryable(response)) {
        throw new Error(`Audit-logs service answered ${response.status}`);
      }
    }
  }

  return {
    async record(event, context = {}) {
      try {
        const ids = [event.actorId, event.targetUserId].filter((id): id is string => Boolean(id));
        const names = await describeUsers(config.users, [...new Set(ids)], config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        const person = (id: string) => ({ type: "user", id, display_name: names.get(id) ?? id });

        const actor = event.actorId ? person(event.actorId) : ANONYMOUS_ACTOR;
        const targetUser = event.targetUserId ? person(event.targetUserId) : null;

        const body = JSON.stringify({
          source: SOURCE,
          action: catalogAction(event),
          outcome: event.outcome === "SUCCESS" ? "success" : "failure",
          actor,
          target: targetUser ?? PORTAL_TARGET,
          ...(targetUser ? { subject: targetUser } : {}),
          description: describe(event, actor.display_name, targetUser?.display_name ?? null),
          occurred_at: new Date().toISOString(),
          ...(context.ipAddress ? { ip_address: context.ipAddress } : {}),
          ...(context.userAgent ? { user_agent: context.userAgent } : {}),
          ...(context.requestId ? { request_id: context.requestId } : {}),
          // One key per event, reused by the retry, so the service never stores it twice.
          idempotency_key: crypto.randomUUID(),
        });

        await post(body);
      } catch (error) {
        console.error("Failed to record audit event", error);
      }
    },

    async listNewest(limit) {
      const response = await send(`/events?limit=${limit}`, { method: "GET", key: config.readKey });

      if (!response.ok) {
        throw new Error(`Audit-logs service answered ${response.status}`);
      }

      const { events } = (await response.json()) as { events: ServiceEvent[] };

      return events.map((row) => ({
        id: row.id,
        occurredAt: new Date(row.occurred_at),
        system: row.source === SOURCE ? "Portal" : row.source,
        action: ACTION_LABELS[row.action] ?? row.action,
        actor: row.actor?.display_name ?? "",
        target: row.target?.display_name ?? "",
        outcome: row.outcome === "success" ? "SUCCESS" : "FAILURE",
        description: row.description ?? "",
      }));
    },
  };
}

export const SYSTEM_LOG_PAGE_SIZE = 100;

/** The System logs page's read. Checks the live Administrator status itself, so a direct call can't bypass the page guard. */
export async function readSystemLogs(
  client: AuditClient,
  viewer: { isAdministrator: boolean } | null,
): Promise<AuditLogEntry[]> {
  if (!viewer?.isAdministrator) {
    throw new Error("System Logs: Administrators only");
  }

  return client.listNewest(SYSTEM_LOG_PAGE_SIZE);
}
