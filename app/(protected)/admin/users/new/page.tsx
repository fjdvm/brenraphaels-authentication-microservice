import { connection } from "next/server";

import { createUserAction } from "@/actions/users";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { NewUserHeading } from "@/components/admin/page-headings";
import { loadUserFormOptions } from "@/lib/admin/user-form-options";
import { requireAdministrator } from "@/lib/auth/session";

/** Figma "Portal · Add new user". */
export default async function NewUserPage() {
  await connection();
  await requireAdministrator();
  const { roles, systems } = await loadUserFormOptions();

  return (
    <main className="flex w-full flex-1 flex-col">
      <NewUserHeading />
      <CreateUserForm action={createUserAction} roles={roles} systems={systems} />
    </main>
  );
}
