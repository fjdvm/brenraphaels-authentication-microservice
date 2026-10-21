"use client";

import { useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditFilterOptions, AuditLogFilters } from "@/lib/audit/audit-logs";
import { dayRangeBounds, type DayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";

const timestampFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Manila",
});

const outcomeDisplay = {
  SUCCESS: { label: "Success", variant: "default" },
  FAILURE: { label: "Failed", variant: "destructive" },
} as const;

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

type Filters = {
  q: string;
  from: string;
  to: string;
  action: string;
  outcome: "" | "SUCCESS" | "FAILURE";
  source: string;
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
};

export function SystemLogsView({ initial, options, defaultRange, load }: Props) {
  const [filters, setFilters] = useState<Filters>({ q: "", ...defaultRange, action: "", outcome: "", source: "" });
  const [search, setSearch] = useState("");
  const [paging, setPaging] = useState<Paging>({ ...FIRST_PAGE, sizes: [initial.status === "ok" ? initial.entries.length : 0] });
  const [result, setResult] = useState<SystemLogsResult | null>(initial);
  const latest = useRef(0);

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

    setFilters(next);

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

  const actionOptions = options?.actions.filter((a) => !filters.source || a.systems.includes(filters.source)) ?? [];
  const loading = result === null;
  const nextCursor = result?.status === "ok" ? result.nextCursor : null;
  const start = paging.sizes.slice(0, paging.index).reduce((sum, n) => sum + n, 0) + 1;

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={submitSearch}
        className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="flex items-end gap-2 sm:col-span-2">
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-on-surface-variant">
            Search
            <Input
              type="search"
              aria-label="Search"
              placeholder="Search user or action"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
          From
          <Input
            type="date"
            aria-label="From"
            value={filters.from}
            aria-invalid={rangeInvalid || undefined}
            onChange={(event) => refilter({ from: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
          To
          <Input
            type="date"
            aria-label="To"
            value={filters.to}
            aria-invalid={rangeInvalid || undefined}
            onChange={(event) => refilter({ to: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
          System
          <select
            aria-label="System"
            className={fieldClass}
            value={filters.source}
            onChange={(event) => refilter({ source: event.target.value })}
          >
            <option value="">All systems</option>
            {options?.systems.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
          Action
          <select
            aria-label="Action"
            className={fieldClass}
            value={filters.action}
            onChange={(event) => refilter({ action: event.target.value })}
          >
            <option value="">All actions</option>
            {actionOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
          Outcome
          <select
            aria-label="Outcome"
            className={fieldClass}
            value={filters.outcome}
            onChange={(event) => refilter({ outcome: event.target.value as Filters["outcome"] })}
          >
            <option value="">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failed</option>
          </select>
        </label>
        {rangeInvalid ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-6">
            From must be on or before To
          </p>
        ) : null}
      </form>

      {rangeInvalid ? null : loading ? (
        <p role="status" className="rounded-lg border border-border bg-surface p-6 text-sm text-on-surface-variant">
          Loading events…
        </p>
      ) : result.status === "error" ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">Couldn&apos;t load System logs</p>
          <p className="mt-1 text-on-surface-variant">The audit-logs service couldn&apos;t be read right now. Try again.</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void open(filters, paging)}>
            Retry
          </Button>
        </div>
      ) : result.entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm">
          <p className="font-medium text-primary">No events match</p>
          <p className="mt-1 text-on-surface-variant">Try a wider date range or fewer filters.</p>
        </div>
      ) : (
        <section aria-label="System logs" className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-260 text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3 font-medium" scope="col">Time (PHT)</th>
                  <th className="px-6 py-3 font-medium" scope="col">System</th>
                  <th className="px-6 py-3 font-medium" scope="col">Actor</th>
                  <th className="px-6 py-3 font-medium" scope="col">Action</th>
                  <th className="px-6 py-3 font-medium" scope="col">Target</th>
                  <th className="px-6 py-3 font-medium" scope="col">Outcome</th>
                  <th className="px-6 py-3 font-medium" scope="col">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-on-surface-variant">
                      <time dateTime={entry.occurredAt.toISOString()}>{timestampFormat.format(entry.occurredAt)}</time>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-on-surface-variant">{entry.system}</td>
                    <td className="px-6 py-4 text-foreground">{entry.actor}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-foreground">{entry.action}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{entry.target}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={outcomeDisplay[entry.outcome].variant}>{outcomeDisplay[entry.outcome].label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!rangeInvalid && result?.status === "ok" ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4">
          <p className="text-sm text-on-surface-variant">
            {result.entries.length > 0 ? `Showing ${start}-${start + result.entries.length - 1}` : null}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paging.index === 0}
              onClick={() => void open(filters, { ...paging, index: paging.index - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!nextCursor}
              onClick={() =>
                void open(filters, {
                  ...paging,
                  cursors: [...paging.cursors.slice(0, paging.index + 1), nextCursor],
                  index: paging.index + 1,
                })
              }
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
