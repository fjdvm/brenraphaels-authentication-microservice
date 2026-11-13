import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createProductionProvisioningPorts, insertProvisionedUser } from "@/lib/admin/user-provisioning.server";
import { resendCredentials } from "@/lib/admin/credential-resend";
import { createProductionResendPorts } from "@/lib/admin/credential-resend.server";
import { createFromRequest } from "./fulfillment";
import type { CreateUserInput } from "@/lib/validations/user";
import { wakeDeliveries } from "./delivery.server";

async function queueStatus(tx: Prisma.TransactionClient, request: { id: string; reference: string }, status: string, actor: string) {
  await tx.accountRequestDelivery.upsert({
    where: { requestId_status: { requestId: request.id, status } },
    create: { requestId: request.id, status, payload: { reference: request.reference, status, actor, occurredAt: new Date().toISOString() } },
    update: {},
  });
}

export async function markRequestSeen(id: string, actor: string) {
  await prisma.$transaction(async tx => {
    const changed = await tx.accountRequest.updateMany({ where: { id, status: "new" }, data: { status: "seen", seenAt: new Date() } });
    if (changed.count) {
      const request = await tx.accountRequest.findUniqueOrThrow({ where: { id } });
      await queueStatus(tx, request, "seen", actor);
    }
  });
  await wakeDeliveries();
}

async function loginSent(id: string, actor: string) {
  await prisma.$transaction(async tx => {
    const request = await tx.accountRequest.update({ where: { id }, data: { loginSentAt: new Date() } });
    await queueStatus(tx, request, "login_sent", actor);
  });
}

export function createFulfillmentPorts(id: string, administrator: { id: string }) {
  const provisioning = createProductionProvisioningPorts();
  return {
    findRequest: (requestId: string) => prisma.accountRequest.findUnique({ where: { id: requestId } }),
    provisioning: {
      ...provisioning,
      store: {
        ...provisioning.store,
        createUser: (user: Parameters<typeof insertProvisionedUser>[1]) => prisma.$transaction(async tx => {
          // The conditional UPDATE locks the request, serializing creation against another admin or cancellation.
          const claimed = await tx.accountRequest.updateMany({ where: { id, status: { in: ["new", "seen"] } }, data: { status: "created", accountCreatedAt: new Date() } });
          if (!claimed.count) throw new Error("Request is no longer open");
          const created = await insertProvisionedUser(tx, user);
          const request = await tx.accountRequest.update({ where: { id }, data: { createdUserId: created.id } });
          await queueStatus(tx, request, "account_created", administrator.id);
          return created;
        }),
      },
    },
    loginSent,
  };
}

export async function fulfillAccountRequest(id: string, input: CreateUserInput, administrator: { id: string }) {
  const result = await createFromRequest(id, input, administrator, createFulfillmentPorts(id, administrator));
  await wakeDeliveries();
  return result;
}

export async function resendRequestLogin(id: string, administrator: { id: string }) {
  const request = await prisma.accountRequest.findUnique({ where: { id } });
  if (!request || request.status !== "created" || !request.createdUserId) return { ok: false as const, error: "No created account is linked to this request." };
  const ports = createProductionResendPorts();
  const result = await resendCredentials(request.createdUserId, administrator, {
    ...ports,
    mailer: { async sendCredentials(message) {
      for (const to of new Set([request.workEmail, request.personalEmail])) await ports.mailer.sendCredentials({ ...message, to });
    } },
  });
  if (result.ok) await loginSent(id, administrator.id);
  await wakeDeliveries();
  return result;
}
