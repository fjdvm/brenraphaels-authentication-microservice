import { Shield, UserPlus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { deleteUserAction, resendCredentialsAction, restoreUserAction } from "@/actions/users";
import { UserDirectory } from "@/components/admin/user-directory";
import { Button } from "@/components/ui/button";
import { listUsers } from "@/lib/admin/users";
import { requireAdministrator } from "@/lib/auth/session";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await connection();
  const administrator = await requireAdministrator();
  const [users, { created }] = await Promise.all([listUsers(), searchParams]);

  return (
    <main className="flex w-full flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[normal]">
          <h1 className="text-2xl font-semibold text-foreground">User management</h1>
          <p className="text-sm text-on-surface-variant">
            Everyone who can log in to the portal. New users get their username and a temporary password by email.
          </p>
        </div>
        <Button asChild size="cta" variant="identity">
          <Link href="/admin/users/new">
            <UserPlus aria-hidden="true" />
            Add new user
          </Link>
        </Button>
      </div>

      {created && /^\d{4}-[A-Z]{2}-\d{3,}$/.test(created) ? (
        <p className="rounded-lg bg-badge-success px-4 py-3 text-sm text-badge-success-foreground" role="status">
          User {created} was created. Their Username and Temporary password have been emailed to them.
        </p>
      ) : null}

      <UserDirectory
        actions={{ resend: resendCredentialsAction, remove: deleteUserAction, restore: restoreUserAction }}
        signedInUserId={administrator.id}
        users={users}
      />

      <p className="flex items-start gap-2 rounded-lg bg-callout p-3 text-[13px] leading-[normal] text-callout-foreground">
        <Shield aria-hidden="true" className="size-4 shrink-0 text-identity" />
        Restoring a deleted user keeps their old password and module access. Review their access after restoring. Super
        Admins cannot be deleted.
      </p>
    </main>
  );
}
