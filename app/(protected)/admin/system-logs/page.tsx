import { connection } from "next/server";

import { loadSystemLogsAction } from "@/actions/system-logs";
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
        heading={
          <>
            <h1 className="text-2xl font-semibold text-foreground">System logs</h1>
            <p className="text-sm text-on-surface-variant">
              Every sign-in, sign-out, password and administrative event, from the portal and every system. Times are shown in Philippine time (UTC+8).
            </p>
          </>
        }
        initial={initial}
        options={options}
        defaultRange={defaultRange}
        load={loadSystemLogsAction}
        canExport={user.isAdministrator}
      />
    </main>
  );
}
