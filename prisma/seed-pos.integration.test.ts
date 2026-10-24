import { randomUUID } from "node:crypto";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createPortalStore, seedPortal, type SeedAuthStore } from "./seed";

// Only point this at a disposable branch: the test exercises the real seed's data migration.
const databaseUrl = process.env.SEED_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("POS Location Management grant on a disposable database", () => {
  it("grants every POS Manager lacking it, skips holders and other Roles, and is idempotent", { timeout: 120_000 }, async () => {
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
      await seedPortal(store, auth, bootstrap);
      const pos = await prisma.system.findUniqueOrThrow({ where: { name: "POS" } });
      const location = await prisma.module.findUniqueOrThrow({
        where: { systemId_name: { systemId: pos.id, name: "Location Management" } },
      });
      const manager = await prisma.role.findUniqueOrThrow({ where: { name: "POS Manager" } });
      const cashier = await prisma.role.findUniqueOrThrow({ where: { name: "Cashier" } });
      const users = [];
      for (const [name, roleId, isDeleted] of [
        ["lacking", manager.id, false], ["holding", manager.id, false],
        ["deleted", manager.id, true], ["cashier", cashier.id, false],
      ] as const) {
        const user = await prisma.user.create({ data: {
          username: `${tag}-${name}`, email: `${tag}-${name}@example.test`,
          firstName: "Seed", lastName: "Test", neonAuthUserId: `${tag}-${name}`, roleId, isDeleted,
        } });
        userIds.push(user.id);
        users.push(user);
      }
      const [lacking, holding, deleted, cashierUser] = users;
      const existing = await prisma.accessGrant.create({ data: {
        userId: holding.id, moduleId: location.id, grantedBy: holding.id,
        grantedAt: new Date("2026-01-01T00:00:00Z"),
      } });

      await seedPortal(store, auth, bootstrap);
      const snapshot = () => prisma.accessGrant.findMany({
        where: { userId: { in: userIds } }, orderBy: { id: "asc" },
      });
      const once = await snapshot();
      await seedPortal(store, auth, bootstrap);

      expect(await snapshot()).toEqual(once);
      expect(once.filter((grant) => grant.userId === lacking.id && grant.moduleId === location.id)).toHaveLength(1);
      expect(once.filter((grant) => grant.userId === holding.id)).toEqual([existing]);
      expect(once.some((grant) => grant.userId === deleted.id || grant.userId === cashierUser.id)).toBe(false);
    } finally {
      const bootstrapUser = await prisma.user.findUnique({ where: { username: bootstrap.username } });
      if (bootstrapUser) userIds.push(bootstrapUser.id);
      await prisma.accessGrant.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.usernameSequence.deleteMany({ where: { year: 2099 } });
      await prisma.$disconnect();
    }
  });
});
