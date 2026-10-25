import { connection } from "next/server";

import { loadMyLogsAction } from "@/actions/my-logs";
import { MyLogsHeading } from "@/components/admin/page-headings";
import { SystemLogsView } from "@/components/admin/system-logs-view";
import { listMyLogEvents } from "@/lib/audit/audit-logs.server";
import { dayRangeBounds, defaultDayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requirePortalUser } from "@/lib/auth/session";

// My Logs: every User's own activity, across every Source. Built from the System logs
// design without the User column, Export, or the System, Action and Outcome filters
// (Spec#51; Figma has no frame for it).
export default async function MyLogsPage() {
  await connection();
  await requirePortalUser();

  const defaultRange = defaultDayRange();

  const initial = await listMyLogEvents(dayRangeBounds(defaultRange)).then(
    (page): SystemLogsResult => ({ status: "ok", ...page }),
    (error): SystemLogsResult => {
      console.error("Failed to read My Logs", error);
      return { status: "error" };
    },
  );

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
