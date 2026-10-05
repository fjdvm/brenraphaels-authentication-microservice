import { connection } from "next/server";

import { requireAdministrator } from "@/lib/auth/session";

export default async function AccessPage() {
  await connection();
  await requireAdministrator();

  return (
    <main className="flex flex-1 flex-col gap-3 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Access</h1>
      <p className="max-w-xl text-sm text-on-surface-variant">
        Your System access is being prepared. It will appear here once the portal launch cards are available.
      </p>
    </main>
  );
}
