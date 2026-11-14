import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading Settings" className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-col gap-1 leading-[normal]">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-on-surface-variant">Rules the shop runs by. Changes are logged under your name.</p>
      </div>
      <Skeleton className="h-44 w-full max-w-2xl rounded-xl" />
    </main>
  );
}
