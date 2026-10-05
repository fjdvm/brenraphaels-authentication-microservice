import "server-only";

import { prisma } from "@/lib/db/prisma";

export type AccessibleSystem = {
  id: string;
  name: string;
  url: string;
  iconName: string | null;
  description: string | null;
};

/**
 * The Systems in which the User currently holds at least one active Module
 * AccessGrant. Derived from grants on every call: never from the User's Role or
 * AccessTemplate, and never stored, so a revoked grant disappears on the next load.
 */
export async function listAccessibleSystems(userId: string): Promise<AccessibleSystem[]> {
  const grants = await prisma.accessGrant.findMany({
    where: { userId },
    select: {
      revokedAt: true,
      user: { select: { isDeleted: true } },
      module: {
        select: {
          system: {
            select: { id: true, name: true, url: true, iconName: true, description: true },
          },
        },
      },
    },
  });

  const systems = new Map<string, AccessibleSystem>();
  for (const { revokedAt, user, module } of grants) {
    if (revokedAt === null && !user.isDeleted) {
      systems.set(module.system.id, module.system);
    }
  }

  return [...systems.values()].sort((a, b) => a.name.localeCompare(b.name));
}
