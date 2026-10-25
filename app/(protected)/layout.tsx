import { connection } from "next/server";

import { AdminShell } from "@/components/layout/admin-shell";
import { PortalShell } from "@/components/layout/portal-shell";
import { requirePortalUser, toShellUser } from "@/lib/auth/session";

// One shell for every signed-in page, so moving between them keeps the sidebar and header
// in place and only the page below swaps. Each page still guards itself: layouts don't
// re-render on client navigation.
export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  await connection();
  const user = await requirePortalUser({ allowMustChangePassword: true });

  return user.isAdministrator ? (
    <AdminShell user={toShellUser(user)}>{children}</AdminShell>
  ) : (
    <PortalShell user={user}>{children}</PortalShell>
  );
}
