import { notFound } from "next/navigation";
import { connection } from "next/server";

import { updateUserAccessAction } from "@/actions/users";
import { EditUserAccessForm } from "@/components/admin/edit-user-access-form";
import { loadUserFormOptions } from "@/lib/admin/user-form-options";
import { loadUserAccess } from "@/lib/admin/user-access.server";
import { requireAdministrator } from "@/lib/auth/session";

export default async function UserAccessPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireAdministrator();
  const { id } = await params;
  const [user, { roles, systems }] = await Promise.all([loadUserAccess(id), loadUserFormOptions()]);

  if (!user) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Access for {user.firstName} {user.lastName}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          <span className="font-mono">{user.username}</span> · {user.email}
        </p>
      </div>
      {user.isDeleted ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="status">
          This User is Deleted. Their access cannot be changed until they are restored.
        </p>
      ) : (
        <EditUserAccessForm
          action={updateUserAccessAction}
          roles={roles.map(({ id: roleId, name }) => ({ id: roleId, name }))}
          systems={systems}
          user={user}
        />
      )}
    </main>
  );
}
