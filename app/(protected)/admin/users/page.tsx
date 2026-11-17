import { connection } from "next/server";

import { UserManagementScreen } from "@/components/admin/user-management-screen";
import { canWrite } from "@/lib/auth/role-authority";
import { requireAdministrator } from "@/lib/auth/session";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await connection();
  const administrator = await requireAdministrator();
  const { created } = await searchParams;

  return <UserManagementScreen administratorId={administrator.id} canWrite={canWrite(administrator.roleName)} created={created} roleName={administrator.roleName} />;
}
