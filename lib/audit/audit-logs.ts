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

/** Filters for one page of the System logs. Absent or blank means no filter. */
export type AuditLogFilters = {
  /** Free text over the description and the Actor and Subject names. */
  q?: string;
  /** Inclusive ISO 8601 bounds, timezone required. */
  from?: string;
  to?: string;
  /** The service's action value, for example "user.login". */
  action?: string;
  outcome?: AuditOutcome;
  /** The service's Source value, for example "Authentication". */
  source?: string;
  /** The `nextCursor` of the previous page, with the same filters. */
  cursor?: string | null;
};

export type AuditLogPage = {
  entries: AuditLogEntry[];
  /** Null on the last page. */
  nextCursor: string | null;
};

/** Values for the Action and System dropdowns, as the service reports them. */
export type AuditFilterOptions = {
  systems: { value: string; label: string }[];
  /** `systems` lists the Sources that can write the action. */
  actions: { value: string; label: string; systems: string[] }[];
};

export type AuditClient = {
  /** Best effort and never throws: a failed audit write must not block any flow. */
  record(event: AuditEventInput, context?: RequestContext): Promise<void>;
  /** Newest first, across every Source. Rejects when the service cannot be read. */
  listPage(query: AuditLogFilters & { limit: number }): Promise<AuditLogPage>;
  /** Rejects when the service cannot be read. */
  filterOptions(): Promise<AuditFilterOptions>;
};

type ClientConfig = {
  baseUrl: string;
  /** Sent as the bearer for writes; through the gateway, a Caller key holding a `write:Authentication` audit key. */
  writeKey: string;
  /** Sent as the bearer for reads; through the gateway, a Caller key holding a `read:admin` audit key. */
  readKey: string;
  users: UserDirectory;
  /** Writes sit on sign-in and admin flows, so they give up quickly. */
  timeoutMs?: number;
  /** Reads only feed the System logs page, so they may wait longer for a cold service. */
  readTimeoutMs?: number;
  fetch?: typeof fetch;
};

/**
 * The audit-logs service as the api-gateway exposes it, under `/audit`. The gateway swaps
 * each Caller key for that Caller's own audit-logs key, and an audit-logs key carries one
 * scope, so writing and reading take two Caller keys. Missing values leave the client
 * unconfigured: every call fails, writes are dropped and reads show the error state.
 */
export function auditGatewayConfig(env: {
  API_GATEWAY_URL?: string;
  API_GATEWAY_KEY?: string;
  API_GATEWAY_AUDIT_READ_KEY?: string;
}): Pick<ClientConfig, "baseUrl" | "writeKey" | "readKey"> {
  const gateway = env.API_GATEWAY_URL?.replace(/\/+$/, "");

  return {
    baseUrl: gateway ? `${gateway}/audit` : "",
    writeKey: env.API_GATEWAY_KEY ?? "",
    readKey: env.API_GATEWAY_AUDIT_READ_KEY ?? "",
  };
}

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
const DEFAULT_READ_TIMEOUT_MS = 8000;

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
  "audit_log.exported": "Exported System logs",
};

const systemLabel = (source: string) => (source === SOURCE ? "Portal" : source);

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
    const timeoutMs =
      rest.method === "GET" ? (config.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS) : (config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    return doFetch(`${base}${path}`, {
      ...rest,
      headers: { Authorization: `Bearer ${key}`, ...(rest.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
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

    async listPage({ limit, cursor, outcome, q, ...filters }) {
      const params = new URLSearchParams({ limit: String(limit) });
      const set = (name: string, value: string | null | undefined) => {
        const trimmed = value?.trim();
        if (trimmed) params.set(name, trimmed);
      };

      set("q", q);
      set("from", filters.from);
      set("to", filters.to);
      set("action", filters.action);
      set("source", filters.source);
      set("outcome", outcome?.toLowerCase());
      set("cursor", cursor);

      const response = await send(`/events?${params}`, { method: "GET", key: config.readKey });

      if (!response.ok) {
        throw new Error(`Audit-logs service answered ${response.status}`);
      }

      const { events, next_cursor } = (await response.json()) as { events: ServiceEvent[]; next_cursor: string | null };

      return {
        nextCursor: next_cursor ?? null,
        entries: events.map((row) => ({
          id: row.id,
          occurredAt: new Date(row.occurred_at),
          system: systemLabel(row.source),
          action: ACTION_LABELS[row.action] ?? row.action,
          actor: row.actor?.display_name ?? "",
          target: row.target?.display_name ?? "",
          outcome: row.outcome === "success" ? "SUCCESS" : "FAILURE",
          description: row.description ?? "",
        })),
      };
    },

    async filterOptions() {
      const response = await send("/events/valid-values", { method: "GET", key: config.readKey });

      if (!response.ok) {
        throw new Error(`Audit-logs service answered ${response.status}`);
      }

      const { sources } = (await response.json()) as { sources: { source: string; actions: string[] }[] };
      const actions = new Map<string, { value: string; label: string; systems: string[] }>();

      for (const { source, actions: names } of sources) {
        for (const value of names) {
          const known = actions.get(value);

          if (known) {
            known.systems.push(source);
          } else {
            actions.set(value, { value, label: ACTION_LABELS[value] ?? value, systems: [source] });
          }
        }
      }

      return {
        systems: sources.map(({ source }) => ({ value: source, label: systemLabel(source) })),
        actions: [...actions.values()],
      };
    },
  };
}

export const SYSTEM_LOG_PAGE_SIZE = 50;

function assertAdministrator(viewer: { isAdministrator: boolean } | null): void {
  if (!viewer?.isAdministrator) {
    throw new Error("System Logs: Administrators only");
  }
}

/** The System logs page's read. Checks the live Administrator status itself, so a direct call can't bypass the page guard. */
export async function readSystemLogs(
  client: AuditClient,
  viewer: { isAdministrator: boolean } | null,
  filters: AuditLogFilters,
): Promise<AuditLogPage> {
  assertAdministrator(viewer);

  return client.listPage({ ...filters, limit: SYSTEM_LOG_PAGE_SIZE });
}

export async function readSystemLogOptions(
  client: AuditClient,
  viewer: { isAdministrator: boolean } | null,
): Promise<AuditFilterOptions> {
  assertAdministrator(viewer);

  return client.filterOptions();
}
