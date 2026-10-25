import { connection } from "next/server";

import { AccessSystemCards } from "@/components/admin/access-system-cards";
import { AccessIntro } from "@/components/admin/page-headings";
import { requireAdministrator } from "@/lib/auth/session";
import { listAccessibleSystems } from "@/lib/portal/accessible-systems";
import { greetingFor } from "@/lib/portal/greeting";

export default async function AccessPage() {
  await connection();
  const administrator = await requireAdministrator();
  const systems = await listAccessibleSystems(administrator.id);

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-col gap-1 leading-[normal]">
        <h1 className="text-2xl font-semibold text-foreground">
          {greetingFor(new Date())}, {administrator.firstName}
        </h1>
        <AccessIntro />
      </div>
      <AccessSystemCards systems={systems} />
    </main>
  );
}
