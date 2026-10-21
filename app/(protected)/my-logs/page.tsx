import { connection } from "next/server";

import { AdminShell } from "@/components/layout/admin-shell";
import { PortalShell } from "@/components/layout/portal-shell";
import { requirePortalUser, toShellUser } from "@/lib/auth/session";

// Every User's own activity. The events themselves arrive with Ticket#62; this
// route exists so the sidebar's My logs entry already reaches a page.
export default async function MyLogsPage() {
  await connection();
  const user = await requirePortalUser();

  const content = (
    <main className="flex flex-1 flex-col gap-1 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">My logs</h1>
      <p className="text-sm text-on-surface-variant">
        Your own sign-ins and actions will be listed here.
      </p>
    </main>
  );

  return user.isAdministrator ? (
    <AdminShell user={toShellUser(user)}>{content}</AdminShell>
  ) : (
    <PortalShell user={user}>{content}</PortalShell>
  );
}
