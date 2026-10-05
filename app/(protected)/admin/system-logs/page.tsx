import { connection } from "next/server";

import { SystemLogsView } from "@/components/admin/system-logs-view";
import { AdminShell } from "@/components/layout/admin-shell";
import { listSystemLogEvents } from "@/lib/audit/system-log";
import { requireAdministrator } from "@/lib/auth/session";

export default async function SystemLogsPage() {
  await connection();
  const administrator = await requireAdministrator();

  const entries = await listSystemLogEvents().catch((error) => {
    console.error("Failed to read System Logs", error);
    return null;
  });

  return (
    <AdminShell firstName={administrator.firstName}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Administration</p>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">System logs</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Portal sign-in, sign-out and password activity. The 200 most recent events.
          </p>
        </div>
        <SystemLogsView entries={entries} />
      </main>
    </AdminShell>
  );
}
