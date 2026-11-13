import { connection } from "next/server";

import { AccountRequestsView } from "@/components/admin/account-requests-view";
import { AccountRequestsHeading } from "@/components/admin/page-headings";
import { listAccountRequests } from "@/lib/admin/account-requests.server";
import { requireAdministrator } from "@/lib/auth/session";

export default async function AccountRequestsPage() {
  await connection();
  await requireAdministrator();

  const result = await listAccountRequests().catch((error) => {
    console.error("Failed to read Account requests", error);
    return null;
  });

  return (
    <main className="flex w-full flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <AccountRequestsView
        heading={<AccountRequestsHeading />}
        now={new Date().toISOString()}
        systems={result?.systems ?? []}
        requests={result?.requests ?? null}
      />
    </main>
  );
}
