import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { createUserAction } from "@/actions/users";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { loadUserFormOptions } from "@/lib/admin/user-form-options";
import { requireAdministrator } from "@/lib/auth/session";

/** Figma "Portal · Add new user". */
export default async function NewUserPage() {
  await connection();
  await requireAdministrator();
  const { roles, systems } = await loadUserFormOptions();

  return (
    <main className="flex w-full flex-1 flex-col">
      <div className="flex flex-col gap-1 px-6 pt-5 leading-[normal] md:px-8">
        <Link
          className="flex w-fit items-center gap-1 rounded-sm text-[13px] font-medium text-on-surface-variant outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          href="/admin/users"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          User management
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Add new user</h1>
        <p className="text-sm text-on-surface-variant">
          Enter their details and choose the systems they can open. They get their username and a temporary password by
          email.
        </p>
      </div>
      <CreateUserForm action={createUserAction} roles={roles} systems={systems} />
    </main>
  );
}
