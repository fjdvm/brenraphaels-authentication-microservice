import { connection } from "next/server";

import { SettingsScreen } from "@/components/admin/settings-screen";
import type { Targets } from "@/components/admin/service-levels-form";
import { canWrite } from "@/lib/auth/role-authority";
import { requireAdministrator } from "@/lib/auth/session";
import { readPaymentAccounts, signQr } from "@/lib/settings/payment-accounts.server";
import { parseAutomaticChecks } from "@/lib/settings/automatic-checks";
import { prisma } from "@/lib/db/prisma";
import { callApprovalLimit, callAutomaticChecks, callServiceLevels } from "@/lib/integrations/approval-limit";

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
    accounts = await signQr(await readPaymentAccounts());
  } catch {
    accounts = null;
  }

  let checks = null;
  try {
    checks = parseAutomaticChecks((await callAutomaticChecks(user.id)).body.checks);
  } catch {
    checks = null;
  }

  let overdueUrl: string | null = null;
  try {
    const system = await prisma.system.findUnique({ where: { name: "CRMS" } });
    if (system) overdueUrl = new URL("/tickets?overdue=1", system.url).toString();
  } catch {
    overdueUrl = null;
  }

  return (
    <main className="flex w-full flex-1 flex-col px-6 py-7 md:px-8">
      <SettingsScreen canEdit={canWrite(user.roleName)} centavos={current} roleName={user.roleName} accounts={accounts} targets={targets} checks={checks} overdueUrl={overdueUrl} />
    </main>
  );
}
