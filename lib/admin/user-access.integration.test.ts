import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Runs against a disposable, migrated and seeded Neon branch (see seed.integration.test.ts).
const testDatabaseUrl = process.env.SEED_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("prismaAccessStore against a real database", () => {
  const created: string[] = [];

  async function setup() {
    process.env.DATABASE_URL = testDatabaseUrl;
    const { prisma } = await import("@/lib/db/prisma");
    const { prismaAccessStore } = await import("./user-access.server");
    const roles = await prisma.role.findMany({ take: 2, orderBy: { name: "asc" } });
    const modules = await prisma.module.findMany({ take: 2, orderBy: { id: "asc" } });
    const admin = await prisma.user.findFirstOrThrow({ where: { role: { isAdministrator: true } } });
    const tag = randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: {
        username: `TEST-${tag}`,
        email: `${tag}@example.test`,
        firstName: "Test",
        lastName: "User",
        roleId: roles[0].id,
        neonAuthUserId: `test-${tag}`,
      },
    });
    created.push(user.id);

    return { prisma, store: prismaAccessStore, roles, modules, admin, user };
  }

  afterAll(async () => {
    if (created.length === 0) return;
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.accessGrant.deleteMany({ where: { userId: { in: created } } });
    await prisma.user.deleteMany({ where: { id: { in: created } } });
  });

  it("grants, revokes and re-grants while keeping history, and Role changes leave grants alone", async () => {
    const { prisma, store, roles, modules, admin, user } = await setup();
    const [first] = modules;
    const base = { userId: user.id, actorId: admin.id };

    await store.apply({ ...base, roleId: roles[0].id, moduleIds: [first.id] });
    await store.apply({ ...base, roleId: roles[0].id, moduleIds: [] });
    const regrant = await store.apply({ ...base, roleId: roles[1].id, moduleIds: [first.id] });
    const roleOnly = await store.apply({ ...base, roleId: roles[0].id, moduleIds: [first.id] });

    const grants = await prisma.accessGrant.findMany({ where: { userId: user.id, moduleId: first.id } });
    expect(grants).toHaveLength(2);
    expect(grants.filter((grant) => grant.revokedAt === null)).toHaveLength(1);
    expect(regrant.roleChange).not.toBeNull();
    expect(regrant.granted).toEqual([expect.stringContaining(first.name)]);
    expect(roleOnly).toMatchObject({ granted: [], revoked: [] });
  });

  it("concurrent saves never create a duplicate active grant", async () => {
    const { prisma, store, roles, modules, admin, user } = await setup();
    const input = { userId: user.id, actorId: admin.id, roleId: roles[0].id, moduleIds: modules.map((m) => m.id) };

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => store.apply(input)));

    const active = await prisma.accessGrant.findMany({ where: { userId: user.id, revokedAt: null } });
    expect(active).toHaveLength(modules.length);
    expect(results.filter((result) => result.status === "fulfilled").length).toBeGreaterThan(0);
  });
});
