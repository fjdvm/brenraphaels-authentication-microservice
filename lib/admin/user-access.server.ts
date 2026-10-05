import "server-only";

import { recordSystemLogEvent } from "@/lib/audit/system-log";
import { prisma } from "@/lib/db/prisma";

import type { AccessPorts, AccessStore } from "./user-access";

export type UserAccessDetails = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  isDeleted: boolean;
  /** Modules with an active AccessGrant right now. */
  activeModuleIds: string[];
};

export async function loadUserAccess(userId: string): Promise<UserAccessDetails | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      roleId: true,
      isDeleted: true,
      accessGrants: { where: { revokedAt: null }, select: { moduleId: true } },
    },
  });

  if (!user) {
    return null;
  }

  const { accessGrants, ...details } = user;

  return { ...details, activeModuleIds: accessGrants.map((grant) => grant.moduleId) };
}

export const prismaAccessStore: AccessStore = {
  findUser(id) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, roleId: true, isDeleted: true },
    });
  },

  async roleExists(roleId) {
    return (await prisma.role.count({ where: { id: roleId } })) === 1;
  },

  countModules(moduleIds) {
    return prisma.module.count({ where: { id: { in: moduleIds } } });
  },

  apply({ userId, roleId, moduleIds, actorId }) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { roleId: true, role: { select: { name: true } } },
      });

      let roleChange: { from: string; to: string } | null = null;

      if (user.roleId !== roleId) {
        const next = await transaction.role.findUniqueOrThrow({
          where: { id: roleId },
          select: { name: true },
        });
        await transaction.user.update({ where: { id: userId }, data: { roleId } });
        roleChange = { from: user.role.name, to: next.name };
      }

      const active = await transaction.accessGrant.findMany({
        where: { userId, revokedAt: null },
        select: { moduleId: true },
      });
      const activeIds = new Set(active.map((grant) => grant.moduleId));
      const toRevoke = [...activeIds].filter((id) => !moduleIds.includes(id));
      const toGrant = moduleIds.filter((id) => !activeIds.has(id));

      // Revoking only stamps revokedAt, so the grant stays as history.
      const revoked = toRevoke.length
        ? (
            await transaction.accessGrant.updateMany({
              where: { userId, moduleId: { in: toRevoke }, revokedAt: null },
              data: { revokedAt: new Date() },
            })
          ).count
        : 0;

      // skipDuplicates is ON CONFLICT DO NOTHING: if a concurrent save already
      // created the active grant, the partial unique index makes this a no-op.
      const granted = toGrant.length
        ? (
            await transaction.accessGrant.createMany({
              data: toGrant.map((moduleId) => ({ userId, moduleId, grantedBy: actorId })),
              skipDuplicates: true,
            })
          ).count
        : 0;

      return { roleChange, granted, revoked };
    });
  },
};

export function createProductionAccessPorts(): AccessPorts {
  return { store: prismaAccessStore, audit: recordSystemLogEvent };
}
