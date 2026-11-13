import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createProductionProvisioningPorts, insertProvisionedUser } from "@/lib/admin/user-provisioning.server";
import { resendCredentials } from "@/lib/admin/credential-resend";
import { createProductionResendPorts } from "@/lib/admin/credential-resend.server";
import { createFromRequest, dualRecipientMailer } from "./fulfillment";
import type { CreateUserInput } from "@/lib/validations/user";
import { startDelivery } from "./delivery.server";

async function queueStatus(tx: Prisma.TransactionClient, request: { id: string; reference: string }, status: string, actor: string) {
  return tx.accountRequestDelivery.upsert({
    where: { requestId_status: { requestId: request.id, status } },
    create: { requestId: request.id, status, payload: { reference: request.reference, status, actor, occurredAt: new Date().toISOString() } },
    update: {},
  });
}

export async function markRequestSeen(id: string, actor: string) {
  const delivery = await prisma.$transaction(async tx => {
    const changed = await tx.accountRequest.updateMany({ where: { id, status: "new" }, data: { status: "seen", seenAt: new Date() } });
    if (changed.count) {
      const request = await tx.accountRequest.findUniqueOrThrow({ where: { id } });
      return queueStatus(tx, request, "seen", actor);
    }
  });
  if (delivery) startDelivery(delivery);
}

async function loginSent(id: string, actor: string) {
  const delivery = await prisma.$transaction(async tx => {
    const request = await tx.accountRequest.update({ where: { id }, data: { loginSentAt: new Date() } });
    return queueStatus(tx, request, "login_sent", actor);
  });
  startDelivery(delivery);
}

export function createFulfillmentPorts(id: string, administrator: { id: string }) {
  const provisioning = createProductionProvisioningPorts();
  const token = randomUUID();
  return {
    findRequest: (requestId: string) => prisma.accountRequest.findUnique({ where: { id: requestId } }),
    releaseDelivery: () => releaseDelivery(id, token),
    provisioning: {
      ...provisioning,
      store: {
        ...provisioning.store,
        createUser: (user: Parameters<typeof insertProvisionedUser>[1]) => prisma.$transaction(async tx => {
          // The conditional UPDATE locks the request, serializing creation against another admin or cancellation.
          const claimed = await tx.accountRequest.updateMany({ where: { id, status: { in: ["new", "seen"] } }, data: { status: "created", accountCreatedAt: new Date() } });
          if (!claimed.count) throw new Error("Request is no longer open");
          const created = await insertProvisionedUser(tx, user);
          const request = await tx.accountRequest.update({ where: { id }, data: { createdUserId: created.id, loginDeliveryToken: token, loginDeliveryUntil: leaseUntil() } });
          const delivery = await queueStatus(tx, request, "account_created", administrator.id);
          return { created, delivery };
        }).then(({ created, delivery }) => { startDelivery(delivery); return created; }),
      },
    },
    loginSent,
  };
}

export async function fulfillAccountRequest(id: string, input: CreateUserInput, administrator: { id: string }) {
  return createFromRequest(id, input, administrator, createFulfillmentPorts(id, administrator));
}

export async function resendRequestLogin(id: string, administrator: { id: string }) {
  const request = await prisma.accountRequest.findUnique({ where: { id } });
  if (!request || request.status !== "created" || !request.createdUserId) return { ok: false as const, error: "No created account is linked to this request." };
  const token = randomUUID();
  const claimed = await prisma.accountRequest.updateMany({
    where: { id, status: "created", OR: [{ loginDeliveryUntil: null }, { loginDeliveryUntil: { lt: new Date() } }] },
    data: { loginDeliveryToken: token, loginDeliveryUntil: leaseUntil() },
  });
  if (!claimed.count) return { ok: false as const, error: "Login details are being sent. Try again after the current delivery finishes (up to five minutes after an interruption)." };
  try {
    const ports = createProductionResendPorts();
    const result = await resendCredentials(request.createdUserId, administrator, {
      ...ports,
      mailer: dualRecipientMailer(ports.mailer, [request.workEmail, request.personalEmail]),
    });
    if (result.ok) await loginSent(id, administrator.id);
    return result;
  } finally { await releaseDelivery(id, token); }
}

// SMTP is bounded to 30 seconds per operation; a crashed sender's lease expires.
const leaseUntil = () => new Date(Date.now() + 5 * 60_000);
async function releaseDelivery(id: string, token: string) {
  await prisma.accountRequest.updateMany({ where: { id, loginDeliveryToken: token }, data: { loginDeliveryToken: null, loginDeliveryUntil: null } });
}
