import Link from "next/link";

import { PortalShell } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { requirePortalUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requirePortalUser();

  return (
    <PortalShell firstName={user.firstName}>
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Welcome, {user.firstName}
        </h1>
        <p className="text-sm text-on-surface-variant">
          You&apos;re logged in. Portal content is coming soon.
        </p>
        {user.isSuperAdmin ? (
          <Button asChild className="mt-4">
            <Link href="/admin/users">Manage users</Link>
          </Button>
        ) : null}
      </main>
    </PortalShell>
  );
}
