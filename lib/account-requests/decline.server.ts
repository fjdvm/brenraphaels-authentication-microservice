import "server-only";
import { prisma } from "@/lib/db/prisma";
import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { declineAccountRequest, createDeclineStore } from "./decline";
import { startDelivery } from "./delivery.server";

export function declineRequest(id: string, input: unknown, administrator: { id: string }) {
  return declineAccountRequest(id, input, administrator, {
    decline: createDeclineStore({ query: sql => prisma.$queryRaw(sql) }),
    startDelivery,
    audit: recordAuditEvent,
  });
}
