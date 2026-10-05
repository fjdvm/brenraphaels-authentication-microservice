import { connection } from "next/server";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdministrator } from "@/lib/auth/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  await requireAdministrator();

  return <AdminShell>{children}</AdminShell>;
}
