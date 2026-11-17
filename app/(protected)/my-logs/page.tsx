import { connection } from "next/server";
import Link from "next/link";

import { loadMemberActivityAction } from "@/actions/member-activity";
import { loadMyLogsAction } from "@/actions/my-logs";
import { MyLogsHeading } from "@/components/admin/page-headings";
import { SystemLogsView } from "@/components/admin/system-logs-view";
import { MemberActivityView } from "@/components/portal/member-activity-view";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { listMemberActivity, listMemberActivityOptions, listMyLogEvents } from "@/lib/audit/audit-logs.server";
import { dayRangeBounds, defaultDayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requirePortalUser } from "@/lib/auth/session";

// Every User's own activity, across every Source. Administrators see it in the Admin shell (built from
// the System logs design without the User column, Export, or the System, Action and Outcome filters,
// Spec#51); everyone else sees the Member "Activity log" frame (Ticket#295).
export default async function MyLogsPage() {
  await connection();
  const user = await requirePortalUser();

  const defaultRange = defaultDayRange();
  const bounds = dayRangeBounds(defaultRange);
  const toResult = (page: Awaited<ReturnType<typeof listMyLogEvents>>): SystemLogsResult => ({ status: "ok", ...page });
  const failed = (error: unknown): SystemLogsResult => {
    console.error("Failed to read the Activity log", error);
    return { status: "error" };
  };

  if (user.isAdministrator) {
    const initial = await listMyLogEvents(bounds).then(toResult, failed);

    return (
      <main className="flex w-full flex-1 flex-col gap-5 px-6 py-7 md:px-8">
        <SystemLogsView
          heading={<MyLogsHeading />}
          initial={initial}
          options={null}
          defaultRange={defaultRange}
          load={loadMyLogsAction}
          scope="mine"
        />
      </main>
    );
  }

  const [initial, options] = await Promise.all([
    listMemberActivity(bounds).then(toResult, failed),
    listMemberActivityOptions().catch(() => null),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col gap-5 bg-canvas px-4 pt-9 pb-7 sm:px-6 xl:px-40">
      <div className="flex flex-col gap-2 leading-[normal]">
        <Link className="flex items-center gap-1.5 self-start text-sm font-semibold text-identity" href="/">
          <FigmaIcon name="back-purple" />
          Back to home
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Activity log</h1>
          <p className="text-sm text-on-surface-variant">
            Everything you did in the Portal and in your systems. Only you and Admins can see this.
          </p>
        </div>
      </div>
      <MemberActivityView defaultRange={defaultRange} initial={initial} load={loadMemberActivityAction} options={options} />
    </main>
  );
}
