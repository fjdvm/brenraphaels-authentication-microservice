import { randomUUID } from "node:crypto";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createPortalStore, seedPortal, type SeedAuthStore } from "./seed";

// Only point this at a disposable branch: the test exercises the real seed's data migration.
const databaseUrl = process.env.SEED_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("IMS seed on a disposable database", () => {
  it("preserves Module IDs and grant history, fills Administrator grants, and is idempotent", { timeout: 120_000 }, async () => {
    const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl! }) });
    const tag = randomUUID();
    const userIds: string[] = [];
    const auth: SeedAuthStore = {
      async findUserByEmail() { return { id: tag }; },
      async createUser() { throw new Error("No identity should be created"); },
      async ensureAdminRoleAndVerifiedEmail() {},
      async disablePublicSignUpAndGoogleSignIn() {},
    };
    const bootstrap = {
      username: "2099-ADMIN-001", firstName: "Seed", lastName: "Test",
      email: `${tag}@example.test`, password: "unused",
    };
    const store = createPortalStore(prisma);
    try {
      const ims = await prisma.system.findUniqueOrThrow({ where: { name: "IMS" } });
      const ceo = await prisma.role.findUniqueOrThrow({ where: { name: "CEO" } });
      const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: "Staff/Employee" } });
      const users = [];
      for (const [name, roleId, isDeleted] of [
        ["ceo", ceo.id, false], ["staff", staffRole.id, false], ["deleted", ceo.id, true],
      ] as const) {
        const user = await prisma.user.create({ data: {
          username: `${tag}-${name}`, email: `${tag}-${name}@example.test`,
          firstName: "Seed", lastName: "Test", neonAuthUserId: `${tag}-${name}`, roleId, isDeleted,
        } });
        userIds.push(user.id);
        users.push(user);
      }
      const [administrator, staff, deleted] = users;
      const renames = [
        ["Inventory Module", "Inventory"],
        ["Production and Quality", "Production & Quality"],
        ["Distribution", "Stock Transfer"],
      ];
      const legacyModules = [];
      for (const [former, current] of renames) {
        const legacyModule = await prisma.module.findFirstOrThrow({
          where: { systemId: ims.id, name: { in: [former, current] } },
        });
        await prisma.module.update({ where: { id: legacyModule.id }, data: { name: former } });
        legacyModules.push({ id: legacyModule.id, name: current });
        await store.upsertAccessGrant(staff.id, legacyModule.id);
      }
      const revoked = await prisma.accessGrant.create({ data: {
        userId: administrator.id, moduleId: legacyModules[0].id,
        revokedAt: new Date("2026-01-01T00:00:00Z"),
      } });
      const historyBefore = await prisma.accessGrant.findMany({ where: { userId: staff.id }, orderBy: { id: "asc" } });
      const registrationBefore = await prisma.system.findUniqueOrThrow({ where: { id: ims.id } });
      await seedPortal(store, auth, bootstrap);
      const seededBootstrap = await prisma.user.findUniqueOrThrow({ where: { username: bootstrap.username } });
      userIds.push(seededBootstrap.id);
      const snapshot = async () => ({
        modules: await prisma.module.findMany({ where: { systemId: ims.id }, orderBy: { name: "asc" } }),
        grants: await prisma.accessGrant.findMany({ where: { module: { systemId: ims.id } }, orderBy: { id: "asc" } }),
        system: await prisma.system.findUniqueOrThrow({ where: { id: ims.id } }),
      });
      const once = await snapshot();
      await seedPortal(store, auth, bootstrap);
      expect(await snapshot()).toEqual(once);
      expect(once.modules.map((module) => module.name)).toEqual([
        "Dashboard", "Goods Receiving", "Inventory", "Orders & Procurement",
        "Production & Quality", "Resources & Suppliers", "Stock Transfer",
      ]);
      for (const legacy of legacyModules) expect(once.modules).toContainEqual(expect.objectContaining(legacy));
      expect(await prisma.accessGrant.findMany({ where: { userId: staff.id }, orderBy: { id: "asc" } })).toEqual(historyBefore);
      expect(await prisma.accessGrant.findUnique({ where: { id: revoked.id } })).toEqual(revoked);
      for (const user of [administrator, seededBootstrap]) {
        expect(once.grants.filter((grant) => grant.userId === user.id && grant.revokedAt === null)).toHaveLength(7);
      }
      expect(await prisma.accessGrant.count({ where: { userId: deleted.id } })).toBe(0);
      expect(await prisma.accessGrant.count({ where: { userId: administrator.id, module: { systemId: { not: ims.id } } } })).toBe(0);
      expect(once.system.url).toBe("https://br-sims.vercel.app");
      expect(once.system.callbackUrls).toEqual(expect.arrayContaining([
        "https://localhost:3003/api/portal/callback", "https://br-sims.vercel.app/api/portal/callback",
        ...registrationBefore.callbackUrls,
      ]));
      expect(once.system.backendSecretHash).toBe(registrationBefore.backendSecretHash);
    } finally {
      await prisma.accessGrant.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.usernameSequence.deleteMany({ where: { year: 2099 } });
      await prisma.$disconnect();
    }
  });
});
