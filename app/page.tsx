import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { AccountCard } from "@/components/portal/account-card";
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
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <SystemLaunchCards systems={systems} />
          <AccountCard user={user} />
        </div>
      </main>
    </PortalShell>
  );
}
