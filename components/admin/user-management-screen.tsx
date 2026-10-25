import { Shield, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { deleteUserAction, resendCredentialsAction, restoreUserAction } from "@/actions/users";
import { UserDirectory } from "@/components/admin/user-directory";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listUsers } from "@/lib/admin/users";

type Props = {
  /** The signed-in Administrator, who can never delete themselves. */
  administratorId: string;
  /** The Username just created, confirmed in a banner. */
  created?: string;
};

/** Everything on Figma "Portal · User management" that needs no data, so it shows the moment the route opens. */
export function UserManagementFrame({ children }: { children: ReactNode }) {
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

      {children}

      <p className="flex items-start gap-2 rounded-lg bg-callout p-3 text-[13px] leading-[normal] text-callout-foreground">
        <Shield aria-hidden="true" className="size-4 shrink-0 text-identity" />
        Restoring a deleted user keeps their old password and module access. Review their access after restoring. Super
        Admins cannot be deleted.
      </p>
    </main>
  );
}

export function UserDirectorySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading users" className="flex flex-col gap-3" role="status">
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/** Figma "Portal · User management"; the Edit access dialog opens over it. */
export async function UserManagementScreen({ administratorId, created }: Props) {
  const users = await listUsers();

  return (
    <UserManagementFrame>
      {created && /^\d{4}-[A-Z]{2}-\d{3,}$/.test(created) ? (
        <p className="rounded-lg bg-badge-success px-4 py-3 text-sm text-badge-success-foreground" role="status">
          User {created} was created. Their Username and Temporary password have been emailed to them.
        </p>
      ) : null}

      <UserDirectory
        actions={{ resend: resendCredentialsAction, remove: deleteUserAction, restore: restoreUserAction }}
        signedInUserId={administratorId}
        users={users}
      />
    </UserManagementFrame>
  );
}
