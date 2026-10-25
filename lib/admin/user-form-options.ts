import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { PORTAL_READS_TAG } from "@/lib/cache/portal-reads";

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
  "use cache: remote";
  cacheLife({ stale: 0, revalidate: 150, expire: 180 });
  cacheTag(PORTAL_READS_TAG);

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
