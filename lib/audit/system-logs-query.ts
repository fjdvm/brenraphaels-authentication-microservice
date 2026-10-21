import type { AuditLogEntry, AuditLogFilters } from "./audit-logs";

/** One page of the System logs as the screen receives it. `error` means the service could not be read. */
export type SystemLogsResult =
  | { status: "ok"; entries: AuditLogEntry[]; nextCursor: string | null }
  | { status: "error" };

/** A day range as the `YYYY-MM-DD` values of the date inputs, read in Philippine time (UTC+8). */
export type DayRange = { from: string; to: string };

const PHILIPPINE_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DEFAULT_RANGE_DAYS = 7;

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The last seven days up to and including today in Philippine time. */
export function defaultDayRange(now: Date = new Date()): DayRange {
  const today = now.getTime() + PHILIPPINE_OFFSET_MS;

  return { from: day(today - (DEFAULT_RANGE_DAYS - 1) * 86_400_000), to: day(today) };
}

/** Inclusive bounds for the service: the start of the first day and the end of the last, both in UTC+8. */
export function dayRangeBounds({ from, to }: Partial<DayRange>): Pick<AuditLogFilters, "from" | "to"> {
  return {
    ...(from ? { from: `${from}T00:00:00.000+08:00` } : {}),
    ...(to ? { to: `${to}T23:59:59.999+08:00` } : {}),
  };
}

const OUTCOMES = new Set(["SUCCESS", "FAILURE"]);
const BOUND = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/;

/** Narrows whatever the browser sent to the filters the service understands; a server action's input is untrusted. */
export function parseSystemLogFilters(input: unknown): AuditLogFilters {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const text = (key: string, max = 200) => {
    const value = raw[key];

    return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : undefined;
  };
  const bound = (key: string) => {
    const value = text(key, 40);

    return value && BOUND.test(value) ? value : undefined;
  };
  const outcome = text("outcome");

  return {
    q: text("q"),
    from: bound("from"),
    to: bound("to"),
    action: text("action"),
    source: text("source"),
    outcome: outcome && OUTCOMES.has(outcome) ? (outcome as AuditLogFilters["outcome"]) : undefined,
    cursor: text("cursor", 2000),
  };
}
