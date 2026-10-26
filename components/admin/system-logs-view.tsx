"use client";

import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  RotateCcw,
  RotateCw,
  Search,
  Shield,
  ShieldX,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Popover } from "radix-ui";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditFilterOptions, AuditLogFilters } from "@/lib/audit/audit-logs";
import { downloadSystemLogsCsv, type ExportOutcome } from "@/lib/audit/system-logs-download";
import { EXPORT_TOO_LARGE_MESSAGE } from "@/lib/audit/system-logs-export";
import {
  dayRangeBounds,
  DEFAULT_RANGE_DAYS,
  type DayRange,
  type SystemLogsResult,
} from "@/lib/audit/system-logs-query";
import { cn } from "@/lib/utils/cn";

const MANILA = "Asia/Manila";
const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, month: "short", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, month: "short", day: "numeric", year: "numeric" });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA });

/** Figma's "Today, 12:30 PM" and "Yesterday, 4:25 PM", in Philippine days; older events name the date. */
function formatEventTime(at: Date, now: Date): string {
  const day = dayKeyFormat.format(at);
  const clock = clockFormat.format(at);

  if (day === dayKeyFormat.format(now)) return `Today, ${clock}`;
  if (day === dayKeyFormat.format(new Date(now.getTime() - 86_400_000))) return `Yesterday, ${clock}`;

  const sameYear = day.slice(0, 4) === dayKeyFormat.format(now).slice(0, 4);
  return `${(sameYear ? dayFormat : dayYearFormat).format(at)}, ${clock}`;
}

const OUTCOME_BADGE = {
  SUCCESS: { label: "Success", variant: "success" },
  FAILURE: { label: "Failed", variant: "failed" },
} as const;

/** Figma's System pills: CRMS in the brand purple, the Portal muted; the other Systems take their Access-card colours. */
const SYSTEM_BADGE: Record<string, string> = {
  CRMS: "bg-brand-badge text-brand-badge-foreground",
  HRMS: "bg-system-hrms text-system-hrms-foreground",
  IMS: "bg-system-ims text-system-ims-foreground",
  POS: "bg-system-pos text-system-pos-foreground",
};

/** The icon beside each action, by the service's action value; anything else shows a generic activity mark. */
const ACTION_ICONS: Record<string, LucideIcon> = {
  "user.login": LogIn,
  "user.login_failed": LogIn,
  "user.logout": LogOut,
  "password.changed": KeyRound,
  "password.forgot_requested": KeyRound,
  "password.forgot_completed": KeyRound,
  "credentials.resent": Mail,
  "user.created": UserPlus,
  "user.deleted": Trash2,
  "user.restored": RotateCcw,
  "user.role_changed": UserCog,
  "access_grant.granted": SlidersHorizontal,
  "access_grant.revoked": SlidersHorizontal,
  "system.handoff_authorized": Shield,
  "system.handoff_exchanged": ArrowUpRight,
  "system.handoff_denied": ShieldX,
  "audit_log.exported": Download,
};

const panel = "rounded-xl border border-panel-border bg-surface";
const field = "flex items-center gap-2 rounded-lg border border-input bg-surface px-3 py-[9px] text-sm leading-[normal]";
const dateField =
  "rounded-lg border border-input bg-surface px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger-text";

const rangeDayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const rangeDay = (day: string) => rangeDayFormat.format(new Date(`${day}T00:00:00Z`));

/** The date-range button: Figma's "Last 7 days" for the default, otherwise the chosen days. */
function rangeLabel({ from, to }: DayRange, defaultRange: DayRange): string {
  if (from === defaultRange.from && to === defaultRange.to) return `Last ${DEFAULT_RANGE_DAYS} days`;
  if (from && to) return `${rangeDay(from)} – ${rangeDay(to)}`;
  if (from) return `From ${rangeDay(from)}`;
  if (to) return `Until ${rangeDay(to)}`;
  return "All dates";
}

type Filters = {
  q: string;
  from: string;
  to: string;
  action: string;
  outcome: "" | "SUCCESS" | "FAILURE";
  source: string;
  module: string;
};

type Paging = {
  /** The cursor that loads each visited page; the first is null. */
  cursors: (string | null)[];
  sizes: number[];
  index: number;
};

const FIRST_PAGE: Paging = { cursors: [null], sizes: [], index: 0 };

function toQuery(filters: Filters, cursor: string | null): AuditLogFilters {
  return {
    ...dayRangeBounds(filters),
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.outcome ? { outcome: filters.outcome } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.module ? { module: filters.module } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

type Props = {
  /** The first page for the default filters, read on the server. */
  initial: SystemLogsResult;
  /** Null when the service could not be asked; the dropdowns then only offer "All". */
  options: AuditFilterOptions | null;
  defaultRange: DayRange;
  load: (query: AuditLogFilters) => Promise<SystemLogsResult>;
  /** The page title and description, with Export CSV beside them. */
  heading?: ReactNode;
  /** Administrators only; the export endpoint checks again. Never offered on My Logs. */
  canExport?: boolean;
  exportCsv?: (query: AuditLogFilters) => Promise<ExportOutcome>;
  /** "mine" is My Logs, a personal history: no Actor column, no Export, and no System, Action or Outcome filter. */
  scope?: "all" | "mine";
};

const COPY = {
  all: {
    title: "System logs",
    search: "Search user or action",
    error: "Couldn't load System logs",
    empty: "Try a wider date range or fewer filters.",
  },
  mine: {
    title: "Your activity",
    search: "Search action",
    error: "Couldn't load your activity",
    empty: "Try a wider date range or another search.",
  },
} as const;

const exportMessages = {
  too_large: EXPORT_TOO_LARGE_MESSAGE,
  error: "Couldn't export System logs. Try again.",
} as const;

export function SystemLogsView({
  initial,
  options,
  defaultRange,
  load,
  heading,
  canExport: canExportProp = false,
  exportCsv = downloadSystemLogsCsv,
  scope = "all",
}: Props) {
  const copy = COPY[scope];
  const personal = scope === "mine";
  const showActor = !personal;
  const canExport = canExportProp && !personal;
  const [filters, setFilters] = useState<Filters>({ q: "", ...defaultRange, action: "", outcome: "", source: "", module: "" });
  const [search, setSearch] = useState("");
  const [paging, setPaging] = useState<Paging>({ ...FIRST_PAGE, sizes: [initial.status === "ok" ? initial.entries.length : 0] });
  const [result, setResult] = useState<SystemLogsResult | null>(initial);
  const latest = useRef(0);
  const [exporting, setExporting] = useState(false);
  const [exportProblem, setExportProblem] = useState<keyof typeof exportMessages | null>(null);

  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  async function open(next: Filters, target: Paging) {
    const request = ++latest.current;
    setResult(null);

    let loaded: SystemLogsResult;
    try {
      loaded = await load(toQuery(next, target.cursors[target.index]));
    } catch {
      loaded = { status: "error" };
    }

    // A slower, older request must not overwrite what the Administrator asked for last.
    if (request !== latest.current) return;

    setPaging({
      ...target,
      sizes: [...target.sizes.slice(0, target.index), loaded.status === "ok" ? loaded.entries.length : 0],
    });
    setResult(loaded);
  }

  function refilter(change: Partial<Filters>) {
    // Text typed into Search is applied with whatever filter changes next, never silently left behind.
    const next = { ...filters, q: search.trim(), ...change };

    // An action only some Systems can write makes no sense under another System.
    if (change.source !== undefined && next.action && options) {
      const action = options.actions.find((a) => a.value === next.action);
      if (next.source && action && !action.systems.includes(next.source)) next.action = "";
    }

    // Likewise a Module belongs to certain Systems.
    if (change.source !== undefined && next.module && options) {
      const known = options.modules.find((m) => m.value === next.module);
      if (next.source && known && !known.systems.includes(next.source)) next.module = "";
    }

    setFilters(next);
    setExportProblem(null);

    if (next.from && next.to && next.from > next.to) {
      // Don't ask for a range the service rejects, and don't leave rows from another range on screen.
      latest.current += 1;
      return;
    }

    void open(next, FIRST_PAGE);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    refilter({ q: search });
  }

  async function exportShown() {
    setExporting(true);
    setExportProblem(null);

    // Exactly what the screen shows: the applied filters and date range, every page of them.
    const outcome = await exportCsv(toQuery(filters, null)).catch((): ExportOutcome => ({ status: "error" }));

    setExporting(false);
    if (outcome.status !== "ok") setExportProblem(outcome.status);
  }

  const actionOptions = options?.actions.filter((a) => !filters.source || a.systems.includes(filters.source)) ?? [];
  const moduleOptions = options?.modules.filter((m) => !filters.source || m.systems.includes(filters.source)) ?? [];
  const loading = result === null;
  const nextCursor = result?.status === "ok" ? result.nextCursor : null;
  const start = paging.sizes.slice(0, paging.index).reduce((sum, n) => sum + n, 0) + 1;

  // The service exports a whole, bounded date range only.
  const exportable = Boolean(filters.from && filters.to) && !rangeInvalid;

  return (
    <div className="flex flex-col gap-5">
      {heading || canExport ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[normal]">{heading}</div>
          {canExport ? (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant="row-action"
                size="cta"
                disabled={!exportable || exporting}
                title={exportable ? undefined : "Choose a From and To date to export"}
                onClick={() => void exportShown()}
              >
                <Download aria-hidden="true" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              {exportProblem ? (
                <p role="alert" className="text-sm text-danger-text sm:text-right">
                  {exportMessages[exportProblem]}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <form role="search" onSubmit={submitSearch} className="flex flex-wrap items-center gap-3">
        <label className={cn(field, "w-full focus-within:ring-2 focus-within:ring-ring sm:w-75")}>
          <Search aria-hidden="true" className="size-4 shrink-0 text-placeholder" />
          <input
            type="search"
            aria-label="Search"
            placeholder={copy.search}
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-placeholder"
          />
        </label>
        {/* Enter applies the search; the date inputs would otherwise stop the form submitting implicitly. */}
        <button type="submit" className="sr-only">
          Apply search
        </button>

        <Popover.Root>
          <Popover.Trigger
            className={cn(
              field,
              "text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              rangeInvalid && "border-danger-text",
            )}
          >
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
            <span className="sr-only">Date range: </span>
            {rangeLabel(filters, defaultRange)}
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 flex gap-3 rounded-xl border border-panel-border bg-surface p-3 shadow-md"
            >
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-field-label">
                From
                <input
                  type="date"
                  aria-label="From"
                  value={filters.from}
                  aria-invalid={rangeInvalid || undefined}
                  onChange={(event) => refilter({ from: event.target.value })}
                  className={dateField}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-field-label">
                To
                <input
                  type="date"
                  aria-label="To"
                  value={filters.to}
                  aria-invalid={rangeInvalid || undefined}
                  onChange={(event) => refilter({ to: event.target.value })}
                  className={dateField}
                />
              </label>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {personal ? null : (
          <>
            <FilterSelect label="Action" value={filters.action} onChange={(action) => refilter({ action })}>
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Outcome"
              value={filters.outcome}
              onChange={(outcome) => refilter({ outcome: outcome as Filters["outcome"] })}
            >
              <option value="">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failed</option>
            </FilterSelect>
            <FilterSelect label="System" value={filters.source} onChange={(source) => refilter({ source })}>
              <option value="">All systems</option>
              {options?.systems.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Module" value={filters.module} onChange={(module) => refilter({ module })}>
              <option value="">All modules</option>
              {moduleOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value}
                </option>
              ))}
            </FilterSelect>
          </>
        )}

        {rangeInvalid ? (
          <p role="alert" className="w-full text-sm text-danger-text">
            From must be on or before To
          </p>
        ) : null}
      </form>

      {rangeInvalid ? null : loading ? (
        <p role="status" className={cn(panel, "p-6 text-sm text-on-surface-variant")}>
          Loading events…
        </p>
      ) : result.status === "error" ? (
        <div role="alert" className="rounded-xl border border-danger-border bg-surface p-6 text-sm leading-[normal]">
          <p className="font-medium text-danger-text">{copy.error}</p>
          <p className="mt-1 text-on-surface-variant">The audit-logs service couldn&apos;t be read right now. Try again.</p>
          <Button className="mt-4" variant="row-action" size="row" onClick={() => void open(filters, paging)}>
            <RotateCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : (
        <section aria-label={copy.title} className={cn(panel, "px-5 py-1")}>
          {result.entries.length === 0 ? (
            <div className="border-b border-table-divider py-10 text-center text-sm leading-[normal]">
              <p className="font-medium text-foreground">No events match</p>
              <p className="mt-1 text-on-surface-variant">{copy.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-240 text-left leading-[normal]">
                <thead className="text-xs font-medium text-on-surface-variant">
                  <tr className="border-b border-table-divider">
                    <th className="w-40 py-3 pr-3 font-medium" scope="col">Time</th>
                    {showActor ? <th className="w-35 py-3 pr-3 font-medium" scope="col">User</th> : null}
                    <th className="w-57.5 py-3 pr-3 font-medium" scope="col">Action</th>
                    <th className="w-22.5 py-3 pr-3 font-medium" scope="col">System</th>
                    <th className="w-25 py-3 pr-3 font-medium" scope="col">Outcome</th>
                    <th className="py-3 font-medium" scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.map((entry) => {
                    const ActionIcon = ACTION_ICONS[entry.actionValue] ?? Activity;
                    const failed = entry.outcome === "FAILURE";

                    return (
                      <tr className="border-b border-table-divider" key={entry.id}>
                        <td className="py-[13px] pr-3 text-sm whitespace-nowrap text-nav-foreground">
                          <time dateTime={entry.occurredAt.toISOString()} suppressHydrationWarning>
                            {formatEventTime(entry.occurredAt, new Date())}
                          </time>
                        </td>
                        {showActor ? (
                          <td className="py-[13px] pr-3 text-sm">
                            {entry.actor ? (
                              <span className="font-medium text-foreground">{entry.actor}</span>
                            ) : (
                              <span className="text-placeholder">Unknown</span>
                            )}
                          </td>
                        ) : null}
                        <td className="py-[13px] pr-3">
                          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <ActionIcon
                              aria-hidden="true"
                              className={cn("size-[15px] shrink-0", failed ? "text-danger-text" : "text-nav-foreground")}
                            />
                            {entry.action}
                          </span>
                        </td>
                        <td className="py-[13px] pr-3">
                          <Badge variant="muted" className={cn("whitespace-nowrap", SYSTEM_BADGE[entry.system])}>
                            {entry.system}
                          </Badge>
                        </td>
                        <td className="py-[13px] pr-3">
                          <Badge variant={OUTCOME_BADGE[entry.outcome].variant} className="whitespace-nowrap">
                            {OUTCOME_BADGE[entry.outcome].label}
                          </Badge>
                        </td>
                        <td className="py-[13px] text-sm text-nav-foreground">{entry.description || entry.target || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <nav aria-label="Pages" className="flex items-center gap-2 pt-3 pb-2 leading-[normal]">
            <p className="flex-1 text-[13px] text-on-surface-variant">
              {result.entries.length > 0 ? `Showing ${start}–${start + result.entries.length - 1}` : null}
            </p>
            <Button
              variant="row-action"
              size="row"
              disabled={paging.index === 0}
              onClick={() => void open(filters, { ...paging, index: paging.index - 1 })}
            >
              <ChevronLeft aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="row-action"
              size="row"
              disabled={!nextCursor}
              onClick={() =>
                void open(filters, {
                  ...paging,
                  cursors: [...paging.cursors.slice(0, paging.index + 1), nextCursor],
                  index: paging.index + 1,
                })
              }
            >
              <ChevronRight aria-hidden="true" />
              Next
            </Button>
          </nav>
        </section>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        className={cn(field, "field-sizing-content appearance-none pr-9 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-on-surface-variant"
      />
    </div>
  );
}
