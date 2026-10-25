import { connection } from "next/server";

import { requireAdministrator } from "@/lib/auth/session";

// The shell comes from the (protected) layout; this keeps non-Administrators out.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  await requireAdministrator();

  return children;
}
