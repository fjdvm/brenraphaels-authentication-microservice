import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { AccountCard } from "@/components/portal/account-card";
import { SystemLaunchCards } from "@/components/portal/system-launch-cards";
import { readPreviousSignIn } from "@/lib/audit/audit-logs.server";
import { requirePortalUser } from "@/lib/auth/session";
import { listAccessibleSystems, listSystemNames } from "@/lib/portal/accessible-systems";
import { greetingFor } from "@/lib/portal/greeting";
import { formatSignInTime } from "@/lib/portal/sign-in-time";

function accessSummary(count: number) {
  if (count === 0) return "You don't have access to any systems yet.";
  return count === 1 ? "You have access to 1 system. Open it below." : `You have access to ${count} systems. Open one below.`;
}

/** Figma "Portal · Staff home". */
export default async function PortalPage() {
  const user = await requirePortalUser();

  if (user.isAdministrator) {
    redirect("/admin/access");
  }

  const [systems, systemNames, previousSignIn] = await Promise.all([
    listAccessibleSystems(user.id),
    listSystemNames(),
    readPreviousSignIn(),
  ]);
  const now = new Date();
  const accessibleNames = new Set(systems.map(({ name }) => name));

  return (
    <PortalShell systemNames={systems.map(({ name }) => name)} user={user}>
      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-10 sm:px-6 xl:px-[120px]">
        <div className="flex flex-col gap-1.5 leading-[normal]">
          <h1 className="text-[28px] font-semibold text-foreground">
            {greetingFor(now)}, {user.firstName}
          </h1>
          <p className="text-[15px] text-on-surface-variant">{accessSummary(systems.length)}</p>
        </div>
        <div className="flex flex-col items-start gap-5 lg:flex-row">
          <div className="w-full min-w-0 flex-1">
            <SystemLaunchCards systems={systems} />
          </div>
          <AccountCard
            email={user.email}
            lastSignIn={previousSignIn ? formatSignInTime(previousSignIn, now) : null}
            otherSystemNames={systemNames.filter((name) => !accessibleNames.has(name))}
            roleName={user.roleName}
            username={user.username}
          />
        </div>
      </main>
    </PortalShell>
  );
}
