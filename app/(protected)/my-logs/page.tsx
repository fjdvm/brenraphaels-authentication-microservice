import { connection } from "next/server";

import { loadMyLogsAction } from "@/actions/my-logs";
import { SystemLogsView } from "@/components/admin/system-logs-view";
import { AdminShell } from "@/components/layout/admin-shell";
import { PortalShell } from "@/components/layout/portal-shell";
import { listMyLogEvents, listMyLogOptions } from "@/lib/audit/audit-logs.server";
import { dayRangeBounds, defaultDayRange, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requirePortalUser, toShellUser } from "@/lib/auth/session";

// My Logs: every User's own activity, across every Source. Built from the System logs
// design without the User column and Export (Spec#51; Figma has no frame for it).
export default async function MyLogsPage() {
  await connection();
  const user = await requirePortalUser();

  const defaultRange = defaultDayRange();

  const [initial, options] = await Promise.all([
    listMyLogEvents(dayRangeBounds(defaultRange)).then(
      (page): SystemLogsResult => ({ status: "ok", ...page }),
      (error): SystemLogsResult => {
        console.error("Failed to read My Logs", error);
        return { status: "error" };
      },
    ),
    listMyLogOptions().catch((error) => {
      console.error("Failed to read My Logs filter options", error);
      return null;
    }),
  ]);

  const content = (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 md:p-8">
      <SystemLogsView
        heading={
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">Activity log</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Your own sign-ins and actions in every System. Times are Philippine time.
            </p>
          </>
        }
        initial={initial}
        options={options}
        defaultRange={defaultRange}
        load={loadMyLogsAction}
        scope="mine"
      />
    </main>
  );

  return user.isAdministrator ? (
    <AdminShell user={toShellUser(user)}>{content}</AdminShell>
  ) : (
    <PortalShell user={user}>{content}</PortalShell>
  );
}
