import { AccessIntro } from "@/components/admin/page-headings";
import { Skeleton } from "@/components/ui/skeleton";

// The greeting names the signed-in Administrator, so it is the one heading that waits for data.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading Systems" className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-col gap-1 leading-[normal]">
        <Skeleton className="h-8 w-64" />
        <AccessIntro />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </main>
  );
}
