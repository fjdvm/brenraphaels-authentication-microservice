import { connection } from "next/server";

import { loadSystemLogsAction } from "@/actions/system-logs";
import { SystemLogsHeading } from "@/components/admin/page-headings";
import { SystemLogsView } from "@/components/admin/system-logs-view";
import { listSystemLogEvents, listSystemLogOptions } from "@/lib/audit/audit-logs.server";
import { dayRangeBounds, defaultDayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requireAdministrator } from "@/lib/auth/session";

export default async function SystemLogsPage() {
  await connection();
  const user = await requireAdministrator();

  const defaultRange = defaultDayRange();

  const [initial, options] = await Promise.all([
    listSystemLogEvents(dayRangeBounds(defaultRange)).then(
      (page): SystemLogsResult => ({ status: "ok", ...page }),
      (error): SystemLogsResult => {
        console.error("Failed to read System Logs", error);
        return { status: "error" };
      },
    ),
    listSystemLogOptions().catch((error) => {
      console.error("Failed to read System Logs filter options", error);
      return null;
    }),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <SystemLogsView
        heading={<SystemLogsHeading />}
        initial={initial}
        options={options}
        defaultRange={defaultRange}
        load={loadSystemLogsAction}
        canExport={user.isAdministrator}
      />
    </main>
  );
}
