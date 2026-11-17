import { connection } from "next/server";

import { SettingsScreen } from "@/components/admin/settings-screen";
import type { Targets } from "@/components/admin/service-levels-form";
import { canWrite } from "@/lib/auth/role-authority";
import { requireAdministrator } from "@/lib/auth/session";
import { readPaymentAccounts } from "@/lib/settings/payment-accounts.server";
import { callApprovalLimit, callServiceLevels } from "@/lib/integrations/approval-limit";

/** Portal · Settings (Figma "Settings · General" and "SLA, triage & routing"). Admin edits; CEO views. */
export default async function SettingsPage() {
  await connection();
  const user = await requireAdministrator();
  let current: number | null = null;
  try {
    const result = await callApprovalLimit(user.id, {});
    if (typeof result.body.amountInCentavos === "number") current = result.body.amountInCentavos;
  } catch {
    current = null;
  }

  let targets: Targets | null = null;
  try {
    const result = await callServiceLevels(user.id, {});
    const { firstReplyHours, resolveHours } = result.body;
    if (typeof firstReplyHours === "number" && typeof resolveHours === "number") targets = { firstReplyHours, resolveHours };
  } catch {
    targets = null;
  }

  let accounts: Awaited<ReturnType<typeof readPaymentAccounts>> | null = null;
  try {
    accounts = await readPaymentAccounts();
  } catch {
    accounts = null;
  }

  return (
    <main className="flex w-full flex-1 flex-col px-6 py-7 md:px-8">
      <SettingsScreen canEdit={canWrite(user.roleName)} centavos={current} roleName={user.roleName} accounts={accounts} targets={targets} />
    </main>
  );
}
