import { formatEventTime } from "@/lib/audit/format-event-time";
import type { AuditLogEntry } from "@/lib/audit/audit-logs";
import { cn } from "@/lib/utils/cn";
import { uiLabel } from "@/lib/utils/ui-label";

/** Figma's System pills in the Member activity tables: CREOMS purple, IMS green, the Portal muted. */
const SYSTEM_PILL: Record<string, string> = {
  CRMS: "bg-[#ede4f7] text-[#5b2a86]",
  IMS: "bg-[#e1f5ee] text-[#0f6e56]",
};
const PORTAL_PILL = "bg-[#f1f1f3] text-[#52525b]";

/** "Signed in", or "Replied to Maria Santos · TKT-208" when the event carries a detail. */
function whatYouDid({ action, description }: Pick<AuditLogEntry, "action" | "description">) {
  return description ? `${action} · ${description}` : action;
}

type ActivityTableProps = {
  entries: AuditLogEntry[];
  /** Figma sets the System and When columns to 140/170 on the home card and 120/160 on the Activity log. */
  columns: "home" | "log";
  now: Date;
  className?: string;
};

const COLUMNS = {
  home: { system: "w-[140px]", when: "w-[170px]" },
  log: { system: "w-[120px]", when: "w-[160px]" },
} as const;

/** Figma "Activity table": What you did, System, When. */
export function ActivityTable({ entries, columns, now, className }: ActivityTableProps) {
  const widths = COLUMNS[columns];
  const row = "flex items-center gap-2 px-4";

  return (
    <div
      className={cn("flex w-full flex-col overflow-hidden rounded-xl border border-panel-border bg-surface leading-[normal]", className)}
      role="table"
    >
      <div className={cn(row, "bg-canvas py-2.5 text-xs font-medium text-on-surface-variant")} role="row">
        <div className="min-w-0 flex-1" role="columnheader">What you did</div>
        <div className={cn("shrink-0", widths.system)} role="columnheader">System</div>
        <div className={cn("shrink-0", widths.when)} role="columnheader">When</div>
      </div>
      {entries.map((entry) => (
        <div className={cn(row, "border-t border-[#f0edf4] py-3")} key={entry.id} role="row">
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground" role="cell">
            {whatYouDid(entry)}
          </div>
          <div className={cn("shrink-0", widths.system)} role="cell">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-[3px] text-xs font-medium whitespace-nowrap",
                SYSTEM_PILL[entry.system] ?? PORTAL_PILL,
              )}
            >
              {uiLabel(entry.system)}
            </span>
          </div>
          <div className={cn("shrink-0 text-[13px] whitespace-nowrap text-on-surface-variant", widths.when)} role="cell">
            <time dateTime={entry.occurredAt.toISOString()} suppressHydrationWarning>
              {formatEventTime(entry.occurredAt, now)}
            </time>
          </div>
        </div>
      ))}
    </div>
  );
}
