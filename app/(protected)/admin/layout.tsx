import { connection } from "next/server";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdministrator, toShellUser } from "@/lib/auth/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const administrator = await requireAdministrator();

  return <AdminShell user={toShellUser(administrator)}>{children}</AdminShell>;
}
