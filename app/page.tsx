import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { SystemLaunchCards } from "@/components/portal/system-launch-cards";
import { requirePortalUser } from "@/lib/auth/session";
import { listAccessibleSystems } from "@/lib/portal/accessible-systems";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requirePortalUser();

  if (user.isAdministrator) {
    redirect("/admin/access");
  }

  const systems = await listAccessibleSystems(user.id);

  return (
    <PortalShell user={user}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Welcome, {user.firstName}
          </h1>
          <p className="text-sm text-on-surface-variant">Open a System you have access to.</p>
        </div>
        <SystemLaunchCards systems={systems} />
      </main>
    </PortalShell>
  );
}
