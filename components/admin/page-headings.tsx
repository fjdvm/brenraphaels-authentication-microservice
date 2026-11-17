import Link from "next/link";
import type { ReactNode } from "react";

import { FigmaIcon } from "@/components/ui/figma-icon";
import { Skeleton } from "@/components/ui/skeleton";

// Headings that need no data. Pages and their loading states share them, so the text
// shows the moment a route opens and the two can never drift apart.

export function SystemLogsHeading() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">System logs</h1>
      <p className="text-sm text-on-surface-variant">
        Every sign-in, sign-out, password and administrative event, from the Portal and every System. Times are shown in
        Philippine time (UTC+8).
      </p>
    </>
  );
}

/** The role pill shows the viewer's Role; without it (the loading state) it is a placeholder. */
export function AccountRequestsHeading({ roleName }: { roleName?: string } = {}) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-semibold text-foreground">Account requests</h1>
        {roleName ? (
          <span className="flex items-center gap-1.25 rounded-full bg-foreground py-1 pr-2.5 pl-2 text-xs font-semibold text-background">
            <FigmaIcon name="shield-12" />
            {roleName}
          </span>
        ) : (
          <Skeleton className="h-6 w-16 rounded-full" />
        )}
      </div>
      <p className="text-sm text-on-surface-variant">
        People staff asked you to create accounts for. Open a request to review it, then create the account with the
        details already filled in.
      </p>
    </>
  );
}

export function MyLogsHeading() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Activity log</h1>
      <p className="text-sm text-on-surface-variant">
        Your own sign-ins and actions, in the Portal and every System. Times are shown in Philippine time (UTC+8).
      </p>
    </>
  );
}

/** Figma "Portal · Add new user": the back link, title and intro above the form. */
export function NewUserHeading({ fromRequest = false }: { fromRequest?: boolean } = {}) {
  return (
    <div className="flex flex-col gap-1 px-6 pt-5 leading-[normal] md:px-8">
      <Link
        className="flex w-fit items-center gap-1 rounded-sm text-[13px] font-medium text-on-surface-variant outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        href={fromRequest ? "/admin/account-requests" : "/admin/users"}
      >
        <FigmaIcon name="back" />
        {fromRequest ? "Account requests" : "User management"}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">Add new user</h1>
      <p className="text-sm text-on-surface-variant">
        Enter their details and choose the systems they can open. They get their username and a temporary password by
        email.
      </p>
    </div>
  );
}

export function AccessIntro() {
  return (
    <p className="text-sm text-on-surface-variant">
      Choose a system to open. You only see the systems your account can use.
    </p>
  );
}

/** A logs page while its entries load: the real heading, skeletons only where data goes. */
export function LogsPageSkeleton({ heading, label }: { heading: ReactNode; label: string }) {
  return (
    <main aria-busy="true" aria-label={label} className="flex w-full flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex min-w-0 flex-col gap-1 leading-[normal]">{heading}</div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-80 w-full" />
    </main>
  );
}
