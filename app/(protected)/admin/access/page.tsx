import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdministrator } from "@/lib/auth/session";

export default async function AccessPage() {
  await connection();
  const administrator = await requireAdministrator();

  return (
    <AdminShell firstName={administrator.firstName}>
      <main className="flex flex-1 flex-col gap-3 p-6">
        <p className="text-sm font-medium text-on-surface-variant">Administration</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Access</h1>
        <p className="max-w-xl text-sm text-on-surface-variant">
          Your System access is being prepared. It will appear here once the portal launch cards are available.
        </p>
      </main>
    </AdminShell>
  );
}
import { connection } from "next/server";
