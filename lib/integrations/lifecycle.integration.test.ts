import { execFileSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.SEED_TEST_DATABASE_URL;

// Runs against a disposable Neon branch only (same convention as the seed test), never
// production. Neon Auth's session table is the one provider boundary faked here.
describe.skipIf(!testDatabaseUrl)("System lifecycle on a disposable Neon branch", () => {
  it(
    "denies the very next request after revocation, deletion and logout, and restores from retained state",
    { timeout: 180_000 },
    async () => {
      process.env.DATABASE_URL = testDatabaseUrl;
      execFileSync("npx", ["prisma", "migrate", "deploy"], {
        env: { ...process.env, DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl },
        stdio: "inherit",
      });

      const { createSystemConsumer } = await import("@/reference/system-consumer/consumer");
      const { prisma } = await import("@/lib/db/prisma");
      const { handleAuthorize, handleExchange, handleValidate } = await import("./endpoints");
      const { prismaHandoffPorts } = await import("./prisma-ports.server");
      const { revokeIntegrationHandles } = await import("./revocation.server");
      const { buildSystemRegistration } = await import("./registration");

      const suffix = Date.now().toString(36);
      const portal = "https://portal.test";
      const callback = "https://system.test/auth/callback";
      const neonSessionId = `neon-session-${suffix}`;
      let centralSessionLive = true;

      const role = await prisma.role.create({ data: { name: `Lifecycle test ${suffix}` } });
      const user = await prisma.user.create({
        data: {
          username: `2099-LC-${suffix}`,
          email: `lifecycle-${suffix}@example.com`,
          firstName: "Lifecycle",
          lastName: "Test",
          roleId: role.id,
          neonAuthUserId: `neon-${suffix}`,
          mustChangePassword: false,
        },
      });
      const { registration, secret } = buildSystemRegistration([callback]);
      const system = await prisma.system.create({
        data: { name: `LIFECYCLE-${suffix}`, url: "https://system.test", ...registration },
      });
      const dashboard = await prisma.module.create({ data: { systemId: system.id, name: "Dashboard" } });
      const reports = await prisma.module.create({ data: { systemId: system.id, name: "Reports" } });
      const dashboardGrant = await prisma.accessGrant.create({ data: { userId: user.id, moduleId: dashboard.id } });
      await prisma.accessGrant.create({ data: { userId: user.id, moduleId: reports.id } });

      const deps = {
        ports: {
          ...prismaHandoffPorts,
          isCentralSessionActive: async () => centralSessionLive,
        },
        audit: async () => undefined,
        resolveSubject: async () => ({ status: "ok" as const, userId: user.id, neonSessionId }),
      };
      const consumer = createSystemConsumer({
        portalUrl: portal,
        systemName: system.name,
        backendSecret: secret,
        callbackUrl: callback,
        fetch: async (input, init) => {
          const request = new Request(input as string, init);

          return new URL(request.url).pathname.endsWith("/exchange")
            ? handleExchange(request, deps)
            : handleValidate(request, deps);
        },
      });

      try {
        const redirect = await handleAuthorize(new Request(consumer.startSignIn().authorizeUrl), deps);
        const signIn = await consumer.completeSignIn(redirect.headers.get("location")!);

        expect(signIn.ok).toBe(true);
        const sessionId = signIn.ok ? signIn.sessionId : "";
        const allowed = async (module: string) => (await consumer.authenticate(sessionId, module)).allow;

        expect(await allowed("Dashboard")).toBe(true);
        expect(await allowed("Reports")).toBe(true);

        // Module revocation: that Module only, on the next request; history retained.
        await prisma.accessGrant.update({ where: { id: dashboardGrant.id }, data: { revokedAt: new Date() } });
        expect(await allowed("Dashboard")).toBe(false);
        expect(await allowed("Reports")).toBe(true);

        // Re-granting restores access on the same handle, with the old row retained.
        await prisma.accessGrant.create({ data: { userId: user.id, moduleId: dashboard.id } });
        expect(await allowed("Dashboard")).toBe(true);
        expect(await prisma.accessGrant.count({ where: { userId: user.id, moduleId: dashboard.id } })).toBe(2);

        // Deletion, then Restore of the same User.
        await prisma.user.update({ where: { id: user.id }, data: { isDeleted: true, deletedAt: new Date() } });
        expect(await allowed("Reports")).toBe(false);
        await prisma.user.update({ where: { id: user.id }, data: { isDeleted: false, deletedAt: null } });
        expect(await allowed("Reports")).toBe(true);

        // Central logout: the provider's session is gone and the handles are marked revoked.
        centralSessionLive = false;
        await revokeIntegrationHandles(neonSessionId);
        expect(await allowed("Reports")).toBe(false);
        expect(await prisma.integrationSession.count({ where: { userId: user.id, revokedAt: { not: null } } })).toBe(1);
      } finally {
        await prisma.integrationSession.deleteMany({ where: { systemId: system.id } });
        await prisma.handoffCode.deleteMany({ where: { systemId: system.id } });
        await prisma.accessGrant.deleteMany({ where: { userId: user.id } });
        await prisma.module.deleteMany({ where: { systemId: system.id } });
        await prisma.system.delete({ where: { id: system.id } });
        await prisma.user.delete({ where: { id: user.id } });
        await prisma.role.delete({ where: { id: role.id } });
      }
    },
  );
});
