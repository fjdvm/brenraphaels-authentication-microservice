import type { ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { LogoutButton, NotificationButton } from "@/components/layout/portal-actions";
import { type ShellUser, UserAvatar } from "@/components/layout/user-identity";
import { uiLabel } from "@/lib/utils/ui-label";

type PortalShellProps = {
  children: ReactNode;
  user: Pick<ShellUser, "firstName" | "lastName" | "roleName">;
  /** The Systems the User can open, named in the log out dialog; omitted where not loaded. */
  systemNames?: string[];
};

/** Figma "Staff log out dialog": "You will be signed out of the portal and CRMS." */
function logoutDescription(systemNames: string[] | undefined) {
  if (!systemNames) return "You will be signed out of the portal and every system you opened.";
  const [last, ...others] = ["the portal", ...systemNames.map(uiLabel)].reverse();
  const signedOutOf = others.length > 0 ? `${others.reverse().join(", ")} and ${last}` : last;
  return `You will be signed out of ${signedOutOf}.`;
}

/** Figma "Staff home" top bar: the shell for Users without a sidebar. */
export function PortalShell({ children, user, systemNames }: PortalShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="flex h-16 w-full items-center gap-6 px-4 sm:px-6 xl:px-40">
          <BrandLockup className="mr-auto h-11 w-[220px] flex-none" />
          <NotificationButton variant="member" />
          <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
            <UserAvatar size="md" user={user} />
            <div className="flex min-w-0 flex-col gap-px">
              <p className="truncate text-sm font-semibold leading-[normal] text-foreground">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs leading-[normal] text-on-surface-variant">{user.roleName}</p>
            </div>
          </div>
          <LogoutButton description={logoutDescription(systemNames)} layout="header" />
        </div>
      </header>
      {children}
    </div>
  );
}
