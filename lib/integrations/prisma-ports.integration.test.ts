import { execFileSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.SEED_TEST_DATABASE_URL;

// Runs against a disposable Neon branch only (same convention as the seed test).
describe.skipIf(!testDatabaseUrl)("handoff persistence on a disposable Neon branch", () => {
  it("lets exactly one of many concurrent exchanges consume a code", { timeout: 120_000 }, async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl },
      stdio: "inherit",
    });

    const { prisma } = await import("@/lib/db/prisma");
    const { prismaHandoffPorts } = await import("./prisma-ports.server");
    const suffix = Date.now().toString(36);

    const role = await prisma.role.create({ data: { name: `Handoff test ${suffix}` } });
    const user = await prisma.user.create({
      data: {
        username: `2099-TS-${suffix}`,
        email: `handoff-${suffix}@example.com`,
        firstName: "Handoff",
        lastName: "Test",
        roleId: role.id,
        neonAuthUserId: `neon-${suffix}`,
        mustChangePassword: false,
      },
    });
    const system = await prisma.system.create({
      data: { name: `HANDOFF-${suffix}`, url: "https://example.com" },
    });
    const module_ = await prisma.module.create({ data: { systemId: system.id, name: "Dashboard" } });
    await prisma.accessGrant.create({ data: { userId: user.id, moduleId: module_.id } });

    const now = new Date();
    const record = {
      codeHash: `hash-${suffix}`,
      systemId: system.id,
      userId: user.id,
      neonSessionId: "neon-session",
      redirectUri: "https://example.com/cb",
      state: "state-0123456789abcdef",
      codeChallenge: "x".repeat(43),
      expiresAt: new Date(now.getTime() + 60_000),
    };

    await prismaHandoffPorts.saveCode(record);

    expect(await prismaHandoffPorts.isUserEligible(user.id)).toBe(true);
    expect(await prismaHandoffPorts.hasActiveGrantInSystem(user.id, system.id)).toBe(true);
    expect(await prismaHandoffPorts.isCentralSessionActive("00000000-0000-0000-0000-000000000000", now)).toBe(false);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => prismaHandoffPorts.consumeCode(record.codeHash, system.id, now)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prismaHandoffPorts.consumeCode(record.codeHash, system.id, now)).toBeNull();

    await prisma.handoffCode.deleteMany({ where: { systemId: system.id } });
    await prisma.accessGrant.deleteMany({ where: { userId: user.id } });
    await prisma.module.delete({ where: { id: module_.id } });
    await prisma.system.delete({ where: { id: system.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });
});
