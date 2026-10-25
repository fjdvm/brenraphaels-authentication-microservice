import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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
export function NewUserHeading() {
  return (
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
