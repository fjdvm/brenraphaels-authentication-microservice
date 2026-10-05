import { connection } from "next/server";

import { requireAdministrator } from "@/lib/auth/session";

export default async function SystemLogsPage() {
  await connection();
  await requireAdministrator();

  return (
    <main className="flex flex-1 flex-col gap-3 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">System logs</h1>
      <p className="max-w-xl text-sm text-on-surface-variant">
        System log review is being prepared. This destination is available only to Administrators.
      </p>
    </main>
  );
}
