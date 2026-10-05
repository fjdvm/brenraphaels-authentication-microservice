import "server-only";

import { recordSystemLogEvent } from "@/lib/audit/system-log";
import { prisma } from "@/lib/db/prisma";

import type { LifecyclePorts, LifecycleStore } from "./user-lifecycle";

export const prismaLifecycleStore: LifecycleStore = {
  async findActor(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { isDeleted: true, role: { select: { isAdministrator: true } } },
    });

    return user && { isDeleted: user.isDeleted, isAdministrator: user.role.isAdministrator };
  },

  findTarget(id) {
    return prisma.user.findUnique({ where: { id }, select: { username: true, isDeleted: true } });
  },

  async setDeleted(id, deleted) {
    const { count } = await prisma.user.updateMany({
      where: { id, isDeleted: !deleted },
      data: { isDeleted: deleted, deletedAt: deleted ? new Date() : null },
    });

    return count === 1;
  },
};

export function createProductionLifecyclePorts(): LifecyclePorts {
  return { store: prismaLifecycleStore, audit: recordSystemLogEvent };
}
