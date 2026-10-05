import { connection } from "next/server";

import { SystemLogsView } from "@/components/admin/system-logs-view";
import { listSystemLogEvents, SYSTEM_LOG_PAGE_SIZE } from "@/lib/audit/system-log";
import { requireAdministrator } from "@/lib/auth/session";

export default async function SystemLogsPage() {
  await connection();
  await requireAdministrator();

  const entries = await listSystemLogEvents().catch((error) => {
    console.error("Failed to read System Logs", error);
    return null;
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">System logs</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Portal sign-in, sign-out and password activity. The {SYSTEM_LOG_PAGE_SIZE} most recent events.
        </p>
      </div>
      <SystemLogsView entries={entries} />
    </main>
  );
}
