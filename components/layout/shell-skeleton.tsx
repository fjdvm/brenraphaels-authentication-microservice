import { Skeleton } from "@/components/ui/skeleton";

/** The signed-in shell before the User's Role is known: sidebar, header and content as placeholders. */
export function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading portal" className="flex min-h-svh flex-1" role="status">
      <aside className="hidden w-64 shrink-0 flex-col gap-3 border-r border-border p-5 md:flex">
        <Skeleton className="mb-3 h-10 w-44" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-6">
          <Skeleton className="size-8 md:hidden" />
        </div>
        <div className="flex flex-col gap-5 px-6 py-7 md:px-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}

/** The root fallback, for pages outside the signed-in shell such as sign-in. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading portal" className="flex flex-1 flex-col items-center gap-4 p-6 pt-24" role="status">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full max-w-md" />
    </div>
  );
}
