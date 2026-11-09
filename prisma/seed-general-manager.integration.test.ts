import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createPortalStore, seedGeneralManager, seedPortal, type SeedAuthStore } from "./seed";

const databaseUrl = process.env.SEED_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("General Manager on a disposable database", () => {
  it("migrates additively, seeds every Module twice, and leaves existing Users and other templates untouched", { timeout: 240_000 }, async () => {
    const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl! }) });
    const tag = randomUUID();
    const auth: SeedAuthStore = {
      async findUserByEmail() { return { id: tag }; },
      async createUser() { throw new Error("No identity should be created"); },
      async ensureAdminRoleAndVerifiedEmail() {},
      async disablePublicSignUpAndGoogleSignIn() {},
    };
    const bootstrap = { username: "2098-ADMIN-001", firstName: "Seed", lastName: "Test", email: `${tag}@example.test`, password: "unused" };
    const snapshot = async () => ({
      roles: await prisma.role.findMany({ where: { name: { not: "General Manager" } }, orderBy: { id: "asc" } }),
      templates: await prisma.accessTemplate.findMany({ where: { role: { name: { not: "General Manager" } } }, orderBy: { id: "asc" } }),
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      grants: await prisma.accessGrant.findMany({ orderBy: { id: "asc" } }),
    });
    const migration = readFileSync("prisma/migrations/20261109000000_general_manager_role/migration.sql", "utf8");
    try {
      const before = await snapshot();
      await seedGeneralManager(createPortalStore(prisma));
      expect(await snapshot()).toEqual(before);
      await seedGeneralManager(createPortalStore(prisma));
      expect(await snapshot()).toEqual(before);
      for (let pass = 0; pass < 2; pass++) {
        for (const statement of migration.split(";").map((s) => s.trim()).filter(Boolean)) {
          await prisma.$executeRawUnsafe(statement);
        }
        expect(await snapshot()).toEqual(before);
      }
      const manager = await prisma.role.findUniqueOrThrow({ where: { name: "General Manager" } });
      expect(manager.isAdministrator).toBe(false);
      expect(await prisma.accessTemplate.count({ where: { roleId: manager.id } })).toBe(await prisma.module.count());
      const store = createPortalStore(prisma);
      await seedPortal(store, auth, bootstrap);
      const existingManager = await prisma.user.create({ data: {
        username: tag, email: `${tag}-manager@example.test`, firstName: "Existing", lastName: "Manager",
        roleId: manager.id, neonAuthUserId: `${tag}-manager`, mustChangePassword: false,
      } });
      const seeded = await snapshot();
      const system = await prisma.system.create({ data: { name: tag, url: "https://example.test", modules: { create: { name: "Custom Module" } } }, include: { modules: true } });
      try {
        await seedPortal(store, auth, bootstrap);
        await seedPortal(store, auth, bootstrap);
        expect(await snapshot()).toEqual(seeded);
        expect(await prisma.accessTemplate.count({ where: { roleId: manager.id, moduleId: system.modules[0].id } })).toBe(1);
        expect(await prisma.role.count({ where: { name: "General Manager" } })).toBe(1);
      } finally {
        await prisma.accessTemplate.deleteMany({ where: { moduleId: system.modules[0].id } });
        await prisma.module.deleteMany({ where: { systemId: system.id } });
        await prisma.system.delete({ where: { id: system.id } });
        await prisma.user.delete({ where: { id: existingManager.id } });
      }
    } finally {
      const user = await prisma.user.findUnique({ where: { username: bootstrap.username } });
      if (user) {
        await prisma.accessGrant.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.usernameSequence.deleteMany({ where: { year: 2098 } });
      await prisma.$disconnect();
    }
  });
});
