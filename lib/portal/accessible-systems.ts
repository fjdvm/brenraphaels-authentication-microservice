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
  /** Their names, alphabetically. */
  grantedModuleNames: string[];
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
    where: { userId, module: { retiredAt: null } },
    select: {
      revokedAt: true,
      user: { select: { isDeleted: true } },
      module: {
        select: {
          id: true,
          name: true,
          system: {
            select: {
              id: true,
              name: true,
              url: true,
              iconName: true,
              description: true,
              _count: { select: { modules: { where: { retiredAt: null } } } },
            },
          },
        },
      },
    },
  });

  const systems = new Map<string, { system: (typeof grants)[number]["module"]["system"]; modules: Map<string, string> }>();
  for (const { revokedAt, user, module } of grants) {
    if (revokedAt === null && !user.isDeleted) {
      const entry = systems.get(module.system.id) ?? { system: module.system, modules: new Map<string, string>() };
      entry.modules.set(module.id, module.name);
      systems.set(module.system.id, entry);
    }
  }

  return [...systems.values()]
    .map(({ system: { _count, ...system }, modules }) => ({
      ...system,
      grantedModules: modules.size,
      grantedModuleNames: [...modules.values()].sort((a, b) => a.localeCompare(b)),
      totalModules: _count.modules,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every System's name, alphabetically, whether or not the User can open it. */
export async function listSystemNames(): Promise<string[]> {
  const systems = await prisma.system.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  return systems.map(({ name }) => name);
}
