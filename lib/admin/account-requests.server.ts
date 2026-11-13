import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { AccessSystem, AccountRequestRow } from "./account-requests";

const day = (date: Date) => date.toISOString().slice(0, 10);

/** Every request with what the list and detail dialog need, newest first. */
export async function listAccountRequests(): Promise<{ requests: AccountRequestRow[]; systems: AccessSystem[] }> {
  const [requests, systems] = await Promise.all([
    prisma.accountRequest.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      include: { role: { select: { name: true } }, sourceSystem: { select: { name: true } } },
    }),
    prisma.system.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        modules: { where: { retiredAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    systems,
    requests: requests.map((request) => ({
      id: request.id,
      reference: request.reference,
      status: request.status,
      sourceSystemName: request.sourceSystem.name,
      personName: request.personName,
      workEmail: request.workEmail,
      mobile: request.mobile,
      position: request.position,
      branch: request.branch,
      startDate: day(request.startDate),
      neededFrom: day(request.neededFrom),
      note: request.note,
      requesterName: request.requesterName,
      roleName: request.role.name,
      moduleIds: request.moduleIds,
      createdAt: request.createdAt.toISOString(),
      accountCreatedAt: request.accountCreatedAt?.toISOString() ?? null,
    })),
  };
}

/** The sidebar badge: requests an Administrator has yet to act on. */
export function countNewAccountRequests() {
  return prisma.accountRequest.count({ where: { status: { in: ["new", "seen"] } } });
}
