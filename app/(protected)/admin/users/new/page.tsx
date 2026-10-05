import { connection } from "next/server";

import { createUserAction } from "@/actions/users";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { loadUserFormOptions } from "@/lib/admin/user-form-options";
import { requireAdministrator } from "@/lib/auth/session";

export default async function NewUserPage() {
  await connection();
  await requireAdministrator();
  const { roles, systems } = await loadUserFormOptions();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Add new user</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Enter the User&apos;s details and choose the Modules they can open. They receive their Username and a Temporary password by email.
        </p>
      </div>
      <CreateUserForm action={createUserAction} roles={roles} systems={systems} />
    </main>
  );
}
