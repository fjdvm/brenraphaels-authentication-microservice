import Link from "next/link";

import { ActivityTable } from "@/components/portal/activity-table";
import { listMyLogEvents } from "@/lib/audit/audit-logs.server";
import { MY_LOGS_DESTINATION } from "@/lib/admin/navigation";

const SHOWN = 5;

/** Figma "Recent activity" card on the Member home: the User's latest few events, newest first. */
export async function RecentActivity() {
  const entries = await listMyLogEvents({}).then(
    (page) => page.entries.slice(0, SHOWN),
    (error) => {
      console.error("Failed to read Recent activity", error);
      return null;
    },
  );

  return (
    <section
      aria-labelledby="recent-activity-title"
      className="flex w-full flex-col gap-2.5 rounded-xl border border-panel-border bg-surface p-6 leading-[normal]"
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-foreground" id="recent-activity-title">
          Recent activity
        </h2>
        <p className="text-xs whitespace-nowrap text-on-surface-variant">Only you and Admins can see this.</p>
        <Link className="text-[13px] font-semibold whitespace-nowrap text-identity" href={MY_LOGS_DESTINATION.href}>
          View all
        </Link>
      </div>
      {entries === null ? (
        <p className="text-sm text-on-surface-variant" role="alert">Couldn&apos;t load your recent activity.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nothing yet. What you do in the Portal and your systems appears here.</p>
      ) : (
        <ActivityTable columns="home" entries={entries} now={new Date()} />
      )}
    </section>
  );
}

export function RecentActivitySkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading Recent activity"
      className="flex w-full flex-col gap-2.5 rounded-xl border border-panel-border bg-surface p-6"
    >
      <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
      <div className="h-[196px] animate-pulse rounded-xl bg-canvas" />
    </section>
  );
}
