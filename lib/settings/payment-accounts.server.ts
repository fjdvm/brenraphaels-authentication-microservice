import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { prisma } from "@/lib/db/prisma";
import { privateFiles } from "@/lib/files/file-storage.server";

import { withSignedQr, type PaymentAccount, type PaymentAccountPorts } from "./payment-accounts";

const select = { id: true, method: true, accountName: true, accountNumber: true, bankName: true, active: true, qrFileId: true } as const;

/** Every account, oldest first: GCash, Maya and bank accounts, active or not. */
export async function readPaymentAccounts(): Promise<PaymentAccount[]> {
  return prisma.paymentAccount.findMany({ select, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

/** Only what customers may be shown. */
export async function readActivePaymentAccounts(): Promise<PaymentAccount[]> {
  return prisma.paymentAccount.findMany({ select, where: { active: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

export const paymentAccountPorts: PaymentAccountPorts = {
  find: (id) => prisma.paymentAccount.findUnique({ select, where: { id } }),
  create: (input, actorId) => prisma.paymentAccount.create({ select, data: { ...input, updatedById: actorId } }),
  update: (id, input, actorId) => prisma.paymentAccount.update({ select, where: { id }, data: { ...input, updatedById: actorId } }),
  setActive: (id, active, actorId) => prisma.paymentAccount.update({ select, where: { id }, data: { active, updatedById: actorId } }),
  setQrFileId: (id, qrFileId, actorId) => prisma.paymentAccount.update({ select, where: { id }, data: { qrFileId, updatedById: actorId } }),
  files: privateFiles,
  async audit({ actorId, action, detail }) {
    await recordAuditEvent({ action, outcome: "SUCCESS", actorId, detail });
  },
};

/** Accounts as a browser or the store may see them: signed QR addresses, no File references. */
export const signQr = (accounts: PaymentAccount[]) => withSignedQr(accounts, privateFiles);
