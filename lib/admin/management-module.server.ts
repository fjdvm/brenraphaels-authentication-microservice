import "server-only";

import { prisma } from "@/lib/db/prisma";

import { managementRefused, MANAGEMENT_MODULE } from "./management-module";

/** Whether this Role and Module selection would hand Management to someone who may not hold it. */
export async function managementBlocked(roleId: string, moduleIds: string[]): Promise<boolean> {
  if (moduleIds.length === 0) return false;

  const selectsManagement =
    (await prisma.module.count({
      where: { id: { in: moduleIds }, name: MANAGEMENT_MODULE, system: { name: "CRMS" } },
    })) > 0;

  if (!selectsManagement) return false;

  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });

  return managementRefused(role?.name ?? null, true);
}
