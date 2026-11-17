"use client";

import { Popover } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";

import { ActivityTable } from "@/components/portal/activity-table";
import { FigmaIcon } from "@/components/ui/figma-icon";
import type { AuditFilterOptions, AuditLogEntry, AuditLogFilters } from "@/lib/audit/audit-logs";
import { dayRangeBounds, DEFAULT_RANGE_DAYS, type DayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { cn } from "@/lib/utils/cn";
import { uiLabel } from "@/lib/utils/ui-label";

// Figma "f/All systems", "f/Last 7 days", "f/All actions": a 14px chevron, then the label.
const filterButton =
  "flex items-center justify-center gap-1.5 rounded-lg border border-input bg-surface px-2.5 py-1.5 text-[13px] font-medium leading-[normal] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const rangeDayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const rangeDay = (day: string) => rangeDayFormat.format(new Date(`${day}T00:00:00Z`));

function rangeLabel({ from, to }: DayRange, defaultRange: DayRange): string {
  if (from === defaultRange.from && to === defaultRange.to) return `Last ${DEFAULT_RANGE_DAYS} days`;
  if (from && to) return `${rangeDay(from)} – ${rangeDay(to)}`;
  if (from) return `From ${rangeDay(from)}`;
  if (to) return `Until ${rangeDay(to)}`;
  return "All dates";
}

type Filters = DayRange & { source: string; action: string };

type Props = {
  /** The first page for the default range, read on the server. */
  initial: SystemLogsResult;
  /** Null when the service could not be asked; the dropdowns then only offer "All". */
  options: AuditFilterOptions | null;
  defaultRange: DayRange;
  load: (query: AuditLogFilters) => Promise<SystemLogsResult>;
};

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
      <FigmaIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" name="down-14" />
      <select
        aria-label={label}
        className={cn(filterButton, "field-sizing-content appearance-none pl-[30px]")}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </div>
  );
}

/** Figma "Member · Activity log": the User's own events under three filters, with a warning beneath. */
export function MemberActivityView({ initial, options, defaultRange, load }: Props) {
  const [filters, setFilters] = useState<Filters>({ ...defaultRange, source: "", action: "" });
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(initial.status === "ok" ? initial.entries : []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.status === "ok" ? initial.nextCursor : null);
  const [failed, setFailed] = useState(initial.status === "error");
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useRef(0);

  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  async function fetchPage(next: Filters, cursor: string | null): Promise<SystemLogsResult> {
    try {
      return await load({
        ...dayRangeBounds(next),
        ...(next.source ? { source: next.source } : {}),
        ...(next.action ? { action: next.action } : {}),
        ...(cursor ? { cursor } : {}),
      });
    } catch {
      return { status: "error" };
    }
  }

  async function refilter(change: Partial<Filters>) {
    const next = { ...filters, ...change };
    // An action only some Systems can write makes no sense under another System.
    if (change.source !== undefined && next.action && options) {
      const action = options.actions.find((a) => a.value === next.action);
      if (next.source && action && !action.systems.includes(next.source)) next.action = "";
    }
    setFilters(next);

    const request = ++latest.current;
    if (next.from && next.to && next.from > next.to) return;

    setEntries(null);
    setFailed(false);
    const result = await fetchPage(next, null);
    if (request !== latest.current) return;

    setEntries(result.status === "ok" ? result.entries : []);
    setNextCursor(result.status === "ok" ? result.nextCursor : null);
    setFailed(result.status === "error");
  }

  async function showMore() {
    if (!nextCursor || !entries) return;
    const request = ++latest.current;
    setLoadingMore(true);
    const result = await fetchPage(filters, nextCursor);
    setLoadingMore(false);
    if (request !== latest.current) return;

    if (result.status === "ok") {
      setEntries([...entries, ...result.entries]);
      setNextCursor(result.nextCursor);
    } else {
      setFailed(true);
    }
  }

  const actionOptions = options?.actions.filter((a) => !filters.source || a.systems.includes(filters.source)) ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <FilterSelect label="System" onChange={(source) => void refilter({ source })} value={filters.source}>
          <option value="">All systems</option>
          {options?.systems.map((system) => (
            <option key={system.value} value={system.value}>
              {uiLabel(system.label)}
            </option>
          ))}
        </FilterSelect>

        <Popover.Root>
          <Popover.Trigger className={cn(filterButton, rangeInvalid && "border-danger-text")}>
            <FigmaIcon name="down-14" />
            <span className="sr-only">Date range: </span>
            {rangeLabel(filters, defaultRange)}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              className="z-50 flex gap-3 rounded-xl border border-panel-border bg-surface p-3 shadow-md"
              sideOffset={6}
            >
              {(["from", "to"] as const).map((bound) => (
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-field-label" key={bound}>
                  {bound === "from" ? "From" : "To"}
                  <input
                    aria-invalid={rangeInvalid || undefined}
                    aria-label={bound === "from" ? "From" : "To"}
                    className="rounded-lg border border-input bg-surface px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger-text"
                    onChange={(event) => void refilter({ [bound]: event.target.value })}
                    type="date"
                    value={filters[bound]}
                  />
                </label>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <FilterSelect label="Action" onChange={(action) => void refilter({ action })} value={filters.action}>
          <option value="">All actions</option>
          {actionOptions.map((action) => (
            <option key={action.value} value={action.value}>
              {action.label}
            </option>
          ))}
        </FilterSelect>
      </div>

      {rangeInvalid ? (
        <p className="text-sm text-danger-text" role="alert">From must be on or before To</p>
      ) : entries === null ? (
        <p className="rounded-xl border border-panel-border bg-surface p-6 text-sm text-on-surface-variant" role="status">
          Loading your activity…
        </p>
      ) : failed ? (
        <p className="rounded-xl border border-danger-border bg-surface p-6 text-sm text-danger-text" role="alert">
          Couldn&apos;t load your activity. Try again.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-panel-border bg-surface p-6 text-sm text-on-surface-variant">
          Nothing here. Try a wider date range or another filter.
        </p>
      ) : (
        <>
          <ActivityTable columns="log" entries={entries} now={new Date()} />
          {nextCursor ? (
            <button
              className={cn(filterButton, "self-start")}
              disabled={loadingMore}
              onClick={() => void showMore()}
              type="button"
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          ) : null}
        </>
      )}

      <div className="flex items-start gap-2.5 rounded-[10px] bg-[#fdf1d8] p-3">
        <FigmaIcon name="alert-16" />
        <p className="flex-1 text-xs leading-[normal] text-[#8a5a00]">
          See something you didn&apos;t do? Change your password and tell an Admin.
        </p>
      </div>
    </>
  );
}
