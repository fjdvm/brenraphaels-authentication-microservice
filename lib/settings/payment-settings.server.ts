import { prisma } from "@/lib/db/prisma";
import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { EMPTY_PAYMENT_SETTINGS, PAYMENT_FIELDS, type PaymentSettings, type PaymentSettingsPorts } from "./payment-settings";

export async function readPaymentSettings(): Promise<PaymentSettings> {
  const row = await prisma.paymentSettings.findUnique({ where: { id: "shop" } });
  if (!row) return { ...EMPTY_PAYMENT_SETTINGS };
  return Object.fromEntries(PAYMENT_FIELDS.map((field) => [field, row[field]])) as PaymentSettings;
}

export const paymentSettingsPorts: PaymentSettingsPorts = {
  read: readPaymentSettings,
  async write(settings, actorId) {
    await prisma.paymentSettings.upsert({ where: { id: "shop" }, create: { id: "shop", ...settings, updatedById: actorId }, update: { ...settings, updatedById: actorId } });
  },
  async audit({ actorId, detail }) {
    await recordAuditEvent({ action: "payment_settings.change", outcome: "SUCCESS", actorId, detail });
  },
};
