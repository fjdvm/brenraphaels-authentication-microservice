import { connection } from "next/server";

import { ApprovalLimitForm } from "@/components/admin/approval-limit-form";
import { requireAdministrator } from "@/lib/auth/session";
import { PaymentSettingsForm } from "@/components/admin/payment-settings-form";
import { callApprovalLimit } from "@/lib/integrations/approval-limit";
import { readPaymentSettings } from "@/lib/settings/payment-settings.server";

/** Portal · Settings (no Figma frame: built from the foundation node). Admin edits; CEO views. */
export default async function SettingsPage() {
  await connection();
  const user = await requireAdministrator();
  const canEdit = user.roleName === "Admin";
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

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-8">
      <div className="flex flex-col gap-1 leading-[normal]">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-on-surface-variant">Rules the shop runs by. Changes are logged under your name.</p>
      </div>
      <ApprovalLimitForm canEdit={canEdit} initialCentavos={current} />
      <PaymentSettingsForm canEdit={canEdit} initial={payment} />
    </main>
  );
}
