import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { SelectableSystem } from "./module-selection";

export type RoleOption = {
  id: string;
  name: string;
  /** The Modules this Role's AccessTemplate pre-checks; only a starting point. */
  templateModuleIds: string[];
};

export type UserFormOptions = {
  roles: RoleOption[];
  systems: SelectableSystem[];
};

export async function loadUserFormOptions(): Promise<UserFormOptions> {
  const [roles, systems] = await Promise.all([
    prisma.role.findMany({
      select: { id: true, name: true, accessTemplates: { select: { moduleId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.system.findMany({
      select: {
        id: true,
        name: true,
        iconName: true,
        modules: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      templateModuleIds: role.accessTemplates.map((template) => template.moduleId),
    })),
    systems,
  };
}
