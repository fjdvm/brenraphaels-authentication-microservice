import { connection } from "next/server";

import { ApprovalLimitForm } from "@/components/admin/approval-limit-form";
import { canWrite } from "@/lib/auth/role-authority";
import { requireAdministrator } from "@/lib/auth/session";
import { PaymentSettingsForm } from "@/components/admin/payment-settings-form";
import { ServiceLevelsForm, type Targets } from "@/components/admin/service-levels-form";
import { callApprovalLimit, callServiceLevels } from "@/lib/integrations/approval-limit";
import { readPaymentSettings } from "@/lib/settings/payment-settings.server";

/** Portal · Settings (no Figma frame: built from the foundation node). Admin edits; CEO views. */
export default async function SettingsPage() {
  await connection();
  const user = await requireAdministrator();
  const canEdit = canWrite(user.roleName);
  let current: number | null = null;
  try {
    const result = await callApprovalLimit(user.id, {});
    if (typeof result.body.amountInCentavos === "number") current = result.body.amountInCentavos;
  } catch {
    current = null;
  }

  let payment = null;
  try {
    payment = await readPaymentSettings();
  } catch {
    payment = null;
  }

  let targets: Targets | null = null;
  try {
    const result = await callServiceLevels(user.id, {});
    const { firstReplyHours, resolveHours } = result.body;
    if (typeof firstReplyHours === "number" && typeof resolveHours === "number") targets = { firstReplyHours, resolveHours };
  } catch {
    targets = null;
  }

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-col gap-1 leading-[normal]">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-on-surface-variant">Rules the shop runs by. Changes are logged under your name.</p>
      </div>
      <ApprovalLimitForm canEdit={canEdit} initialCentavos={current} />
      <ServiceLevelsForm canEdit={canEdit} initial={targets} />
      <PaymentSettingsForm canEdit={canEdit} initial={payment} />
    </main>
  );
}
