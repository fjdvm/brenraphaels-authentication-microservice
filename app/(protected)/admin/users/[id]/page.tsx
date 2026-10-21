import { notFound } from "next/navigation";
import { connection } from "next/server";

import { updateUserAccessAction } from "@/actions/users";
import { EditUserAccessForm } from "@/components/admin/edit-user-access-form";
import { UserManagementScreen } from "@/components/admin/user-management-screen";
import { loadUserFormOptions } from "@/lib/admin/user-form-options";
import { loadUserAccess } from "@/lib/admin/user-access.server";
import { requireAdministrator } from "@/lib/auth/session";

/** Figma "Portal · Edit access dialog": User management with the dialog open over it. */
export default async function UserAccessPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const administrator = await requireAdministrator();
  const { id } = await params;
  const [user, { roles, systems }] = await Promise.all([loadUserAccess(id), loadUserFormOptions()]);

  if (!user) {
    notFound();
  }

  return (
    <>
      <UserManagementScreen administratorId={administrator.id} />
      <EditUserAccessForm
        action={updateUserAccessAction}
        key={user.id}
        roles={roles.map(({ id: roleId, name }) => ({ id: roleId, name }))}
        systems={systems}
        user={user}
      />
    </>
  );
}
