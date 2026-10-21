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

/** Who performed an event, as the service stores it. Portal Users are `{ type: "user", id: User id }`. */
export type AuditActor = { type: string; id: string };

/** An export covers a whole date range: the service requires both bounds and takes no cursor. */
export type AuditExportFilters = Omit<AuditLogFilters, "cursor" | "from" | "to"> & { from: string; to: string };

export type AuditExport =
  | { status: "ok"; body: ReadableStream<Uint8Array> }
  /** More events match than the service's cap; nothing was streamed and no export event was written. */
  | { status: "too_large" };

/** Who asked for an export; keys carry no identity, so the service records this as the Actor. */
export type ExportRequester = { id: string; name: string };

export type AuditClient = {
  /** Best effort and never throws: a failed audit write must not block any flow. */
  record(event: AuditEventInput, context?: RequestContext): Promise<void>;
  /** Newest first, across every Source; `actor` keeps only that Actor's events. Rejects when the service cannot be read. */
  listPage(query: AuditLogFilters & { limit: number; actor?: AuditActor }): Promise<AuditLogPage>;
  /** Rejects when the service cannot be read. */
  filterOptions(): Promise<AuditFilterOptions>;
  /** Streams the matching events as CSV, newest first. Rejects when the service cannot be read. */
  exportCsv(filters: AuditExportFilters, requestedBy: ExportRequester): Promise<AuditExport>;
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
// Counting up to the cap takes a while, and the api-gateway itself waits 25 seconds for headers.
const EXPORT_HEADERS_TIMEOUT_MS = 30_000;

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

/** The Actor type the Portal records for its Users, with the User id as the Actor id. */
const PORTAL_USER_ACTOR = "user";

/** How the Portal names a User on events and exports, e.g. "Ada Min (2026-ADMIN-001)". */
export function userDisplayName(user: { firstName: string; lastName: string; username: string }): string {
  return `${user.firstName} ${user.lastName} (${user.username})`;
}

/** The filters as the service's query parameters; blank values are left out. */
function filterParams(filters: AuditLogFilters, params = new URLSearchParams()): URLSearchParams {
  const set = (name: string, value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) params.set(name, trimmed);
  };

  set("q", filters.q);
  set("from", filters.from);
  set("to", filters.to);
  set("action", filters.action);
  set("source", filters.source);
  set("outcome", filters.outcome?.toLowerCase());
  set("cursor", filters.cursor);

  return params;
}

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

  const send = async (path: string, init: RequestInit & { key: string; stream?: boolean }) => {
    const { key, stream, ...rest } = init;
    const request = (signal: AbortSignal) =>
      doFetch(`${base}${path}`, {
        ...rest,
        headers: { Authorization: `Bearer ${key}`, ...(rest.body ? { "Content-Type": "application/json" } : {}) },
        cache: "no-store",
        signal,
      });

    if (!stream) {
      return request(AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    }

    // A streamed body may take minutes; only the wait for the response headers is bounded.
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new DOMException("timed out", "TimeoutError")),
      EXPORT_HEADERS_TIMEOUT_MS,
    );

    try {
      return await request(controller.signal);
    } finally {
      clearTimeout(timer);
    }
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
        const person = (id: string) => ({ type: PORTAL_USER_ACTOR, id, display_name: names.get(id) ?? id });

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

    async listPage({ limit, actor, ...filters }) {
      const params = filterParams(filters, new URLSearchParams({ limit: String(limit) }));

      if (actor) {
        params.set("actor_type", actor.type);
        params.set("actor_id", actor.id);
      }

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

    async exportCsv(filters, requestedBy) {
      // The service takes no cursor or limit on an export and rejects parameters it doesn't know.
      const params = filterParams({ ...filters, cursor: null });
      params.set("format", "csv");
      params.set("requested_by_id", requestedBy.id);
      params.set("requested_by_name", requestedBy.name);

      const response = await send(`/events/export?${params}`, { method: "GET", key: config.readKey, stream: true });

      if (response.status === 413) {
        await response.body?.cancel();
        return { status: "too_large" };
      }

      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error(`Audit-logs service answered ${response.status}`);
      }

      return { status: "ok", body: response.body };
    },
  };
}

export const SYSTEM_LOG_PAGE_SIZE = 50;

function assertAdministrator<T extends { isAdministrator: boolean }>(viewer: T | null): asserts viewer is T {
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

/** The System logs Export CSV. Checks the live Administrator status itself, like the page's read. */
export async function exportSystemLogs(
  client: AuditClient,
  viewer: { id: string; firstName: string; lastName: string; username: string; isAdministrator: boolean } | null,
  filters: AuditExportFilters,
): Promise<AuditExport> {
  assertAdministrator(viewer);

  return client.exportCsv(filters, { id: viewer.id, name: userDisplayName(viewer) });
}

export async function readSystemLogOptions(
  client: AuditClient,
  viewer: { isAdministrator: boolean } | null,
): Promise<AuditFilterOptions> {
  assertAdministrator(viewer);

  return client.filterOptions();
}

/**
 * My Logs: one page of the events the signed-in User performed themselves, across every Source.
 * The Actor always comes from `viewer` (the session), never from `filters`, so a request
 * cannot widen the read to another User or to events performed on this one.
 */
export async function readMyLogs(
  client: AuditClient,
  viewer: { id: string } | null,
  filters: AuditLogFilters,
): Promise<AuditLogPage> {
  // A blank id would drop the Actor filter and widen the read to everyone.
  if (!viewer?.id) {
    throw new Error("My Logs: sign in required");
  }

  const { q, from, to, action, outcome, source, cursor } = filters;

  return client.listPage({
    q,
    from,
    to,
    action,
    outcome,
    source,
    cursor,
    limit: SYSTEM_LOG_PAGE_SIZE,
    actor: { type: PORTAL_USER_ACTOR, id: viewer.id },
  });
}

export async function readMyLogOptions(
  client: AuditClient,
  viewer: { id: string } | null,
): Promise<AuditFilterOptions> {
  if (!viewer) {
    throw new Error("My Logs: sign in required");
  }

  return client.filterOptions();
}
