import { connection } from "next/server";

import { loadSystemLogsAction } from "@/actions/system-logs";
import { SystemLogsView } from "@/components/admin/system-logs-view";
import { listSystemLogEvents, listSystemLogOptions } from "@/lib/audit/audit-logs.server";
import { dayRangeBounds, defaultDayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requireAdministrator } from "@/lib/auth/session";

export default async function SystemLogsPage() {
  await connection();
  await requireAdministrator();

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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">System logs</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Activity from every System, recorded in the audit-logs service. Times are Philippine time.
        </p>
      </div>
      <SystemLogsView initial={initial} options={options} defaultRange={defaultRange} load={loadSystemLogsAction} />
    </main>
  );
}
