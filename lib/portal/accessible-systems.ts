import "server-only";

import { prisma } from "@/lib/db/prisma";

export type AccessibleSystem = {
  id: string;
  name: string;
  url: string;
  iconName: string | null;
  description: string | null;
  /** Distinct Modules in this System the User holds an active AccessGrant for. */
  grantedModules: number;
  /** Every Module the System has. */
  totalModules: number;
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
          id: true,
          system: {
            select: {
              id: true,
              name: true,
              url: true,
              iconName: true,
              description: true,
              _count: { select: { modules: true } },
            },
          },
        },
      },
    },
  });

  const systems = new Map<string, { system: (typeof grants)[number]["module"]["system"]; modules: Set<string> }>();
  for (const { revokedAt, user, module } of grants) {
    if (revokedAt === null && !user.isDeleted) {
      const entry = systems.get(module.system.id) ?? { system: module.system, modules: new Set<string>() };
      entry.modules.add(module.id);
      systems.set(module.system.id, entry);
    }
  }

  return [...systems.values()]
    .map(({ system: { _count, ...system }, modules }) => ({
      ...system,
      grantedModules: modules.size,
      totalModules: _count.modules,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
