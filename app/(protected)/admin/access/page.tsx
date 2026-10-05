import { connection } from "next/server";

import { SystemLaunchCards } from "@/components/portal/system-launch-cards";
import { requireAdministrator } from "@/lib/auth/session";
import { listAccessibleSystems } from "@/lib/portal/accessible-systems";

export default async function AccessPage() {
  await connection();
  const administrator = await requireAdministrator();
  const systems = await listAccessibleSystems(administrator.id);

  return (
    <main className="flex flex-1 flex-col gap-4 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Access</h1>
      <SystemLaunchCards systems={systems} />
    </main>
  );
}
