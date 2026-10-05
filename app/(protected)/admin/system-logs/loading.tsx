import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading System Logs" className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </main>
  );
}
