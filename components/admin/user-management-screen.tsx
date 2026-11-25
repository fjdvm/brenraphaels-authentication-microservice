import { Shield, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { deleteUserAction, resendCredentialsAction, restoreUserAction } from "@/actions/users";
import { CreatedUserToast } from "@/components/admin/created-user-toast";
import { UserDirectory } from "@/components/admin/user-directory";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listUsers } from "@/lib/admin/users";

type Props = {
  /** The signed-in Administrator, who can never delete themselves. */
  administratorId: string;
  /** Their Role, shown as the pill beside the title. */
  roleName: string;
  /** Full access (Admin) shows every write control; View access (CEO) shows none. */
  canWrite: boolean;
  /** The Username just created, confirmed in a toast. */
  created?: string;
};

type Viewer = { roleName: string; canWrite: boolean };

/**
 * Everything on Figma "Portal · User management" that needs no data, so it shows the moment the route opens.
 * Without a viewer (the loading state) the role pill is a placeholder and no write control shows, since the Role is not yet known.
 */
export function UserManagementFrame({ children, viewer }: { children: ReactNode; viewer?: Viewer }) {
  return (
    <main className="flex w-full flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[normal]">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-foreground">User management</h1>
            {viewer ? (
              <span className="flex items-center gap-[5px] rounded-full bg-foreground py-1 pr-2.5 pl-2 text-xs font-semibold text-background">
                <Shield aria-hidden="true" className="size-3" />
                {viewer.roleName}
              </span>
            ) : (
              <Skeleton className="h-6 w-16 rounded-full" />
            )}
          </div>
          <p className="text-sm text-on-surface-variant">
            Everyone who can log in to the portal. New users get their username and a temporary password by email.
          </p>
        </div>
        {viewer?.canWrite ? (
          <Button asChild size="cta" variant="identity">
            <Link href="/admin/users/new">
              <UserPlus aria-hidden="true" />
              Add new user
            </Link>
          </Button>
        ) : null}
      </div>

      {children}

      <p className="flex items-start gap-2 rounded-lg bg-callout p-3 text-[13px] leading-[normal] text-callout-foreground">
        <Shield aria-hidden="true" className="size-4 shrink-0 text-identity" />
        Restoring a deleted user keeps their old password and module access. Review their access after restoring. Admins
        cannot be deleted.
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
export async function UserManagementScreen({ administratorId, roleName, canWrite, created }: Props) {
  const users = await listUsers();

  return (
    <UserManagementFrame viewer={{ roleName, canWrite }}>
      {created && /^\d{4}-[A-Z]{2}-\d{3,}$/.test(created) ? <CreatedUserToast username={created} /> : null}

      <UserDirectory
        canWrite={canWrite}
        actions={{ resend: resendCredentialsAction, remove: deleteUserAction, restore: restoreUserAction }}
        signedInUserId={administratorId}
        users={users}
      />
    </UserManagementFrame>
  );
}
