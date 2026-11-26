import { Activity } from "lucide-react";
import Link from "next/link";

import { MY_LOGS_DESTINATION } from "@/lib/admin/navigation";
import type { AuditLogEntry } from "@/lib/audit/audit-logs";
import { formatEventTime } from "@/lib/audit/format-event-time";

/** How many of the Administrator's latest events the Access dashboard shows. */
export const RECENT_ACTIVITY_SHOWN = 5;

/** Figma "Portal · Access": the signed-in Administrator's latest activity, with a link to their full Activity log. */
export function RecentActivity({ entries, now }: { entries: AuditLogEntry[]; now: Date }) {
  return (
    <section
      aria-label="Your recent activity"
      className="flex flex-col gap-2.5 rounded-xl border border-panel-border bg-surface px-5 py-4 leading-[normal]"
    >
      <div className="flex items-center">
        <h2 className="flex-1 text-[15px] font-semibold text-foreground">Your recent activity</h2>
        <Link
          className="rounded-sm text-[13px] font-medium text-identity outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={MY_LOGS_DESTINATION.href}
        >
          View all
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No recent activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.slice(0, RECENT_ACTIVITY_SHOWN).map((entry) => (
            <li className="flex items-center gap-2.5 whitespace-nowrap" key={entry.id}>
              <Activity aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
              <span className="text-sm font-medium text-foreground">{entry.action}</span>
              <span className="truncate text-[13px] text-on-surface-variant">
                · {entry.system} · {formatEventTime(entry.occurredAt, now)}
                {entry.description ? ` · ${entry.description}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
