import { NewUserHeading } from "@/components/admin/page-headings";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading the new user form" className="flex w-full flex-1 flex-col">
      <NewUserHeading />
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    </main>
  );
}
