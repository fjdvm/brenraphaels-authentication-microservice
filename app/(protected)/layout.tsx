import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { AdminShell } from "@/components/layout/admin-shell";
import { PortalShell } from "@/components/layout/portal-shell";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { countNewAccountRequests } from "@/lib/admin/account-requests.server";
import { requirePortalUser, toShellUser } from "@/lib/auth/session";

// One shell for every signed-in page, so moving between them keeps the sidebar and header
// in place and only the page below swaps. Each page still guards itself: layouts don't
// re-render on client navigation.
export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  await connection();
  const user = await requirePortalUser({ allowMustChangePassword: true });

  // The badge is read on each render of the shell (navigation, reload), never on a timer.
  const newAccountRequests = user.isAdministrator ? await countNewAccountRequests().catch(() => 0) : 0;

  return user.isAdministrator ? (
    <AdminShell newAccountRequests={newAccountRequests} user={toShellUser(user)}>
      {children}
    </AdminShell>
  ) : (
    <PortalShell user={user}>{children}</PortalShell>
  );
}
