import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { authorizeHandoff } from "../lib/integrations/handoff";

import { createPortalStore, seedPortal, type SeedAuthStore } from "./seed";

vi.mock("server-only", () => ({}));

// Use a disposable branch, as with the other seed integration tests.
const databaseUrl = process.env.SEED_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("CRMS domain cutover seed on a disposable database", () => {
  it("updates the address in place and preserves registration and access on repeat seeding", { timeout: 240_000 }, async () => {
    process.env.DATABASE_URL = databaseUrl;
    const { prisma } = await import("../lib/db/prisma");
    const { prismaHandoffPorts } = await import("../lib/integrations/prisma-ports.server");
    const tag = randomUUID();
    const bootstrap = {
      username: "2098-ADMIN-001", firstName: "Seed", lastName: "Test",
      email: `${tag}@example.test`, password: "unused",
    };
    const auth: SeedAuthStore = {
      async findUserByEmail() { return { id: tag }; },
      async createUser() { throw new Error("No identity should be created"); },
      async ensureAdminRoleAndVerifiedEmail() {},
      async disablePublicSignUpAndGoogleSignIn() {},
    };
    const store = createPortalStore(prisma);
    try {
      await seedPortal(store, auth, bootstrap);
      const crms = await prisma.system.update({
        where: { name: "CRMS" },
        data: {
          url: "https://epic-crms.vercel.app",
          callbackUrls: [
            "https://epic-crms.vercel.app/api/portal/callback",
            "https://operator.example/callback",
          ],
          backendSecretHash: "existing-backend-secret-hash",
        },
      });
      const snapshot = async () => ({
        system: await prisma.system.findUniqueOrThrow({ where: { name: "CRMS" } }),
        modules: await prisma.module.findMany({ where: { systemId: crms.id }, orderBy: { id: "asc" } }),
        grants: await prisma.accessGrant.findMany({ orderBy: { id: "asc" } }),
        templates: await prisma.accessTemplate.findMany({ orderBy: { id: "asc" } }),
      });
      const before = await snapshot();
      await seedPortal(store, auth, bootstrap);
      const once = await snapshot();

      expect(once.system).toEqual({
        ...crms,
        url: "https://creoms.buildwrite.me",
        callbackUrls: [
          "https://epic-crms.vercel.app/api/portal/callback",
          "https://operator.example/callback",
          "https://creoms.buildwrite.me/api/portal/callback",
          "http://localhost:3000/api/portal/callback",
        ],
      });
      expect(once.modules).toEqual(before.modules);
      expect(once.grants).toEqual(before.grants);
      expect(once.templates).toEqual(before.templates);
      await seedPortal(store, auth, bootstrap);
      expect(await snapshot()).toEqual(once);

      const user = await prisma.user.findUniqueOrThrow({ where: { username: bootstrap.username } });
      for (const redirectUri of [
        "https://creoms.buildwrite.me/api/portal/callback",
        "https://epic-crms.vercel.app/api/portal/callback",
      ]) {
        const result = await authorizeHandoff(prismaHandoffPorts, {
          system: "CRMS", redirectUri, state: "creoms-cutover-state-0123456789",
          codeChallenge: "x".repeat(43), codeChallengeMethod: "S256",
          subject: { userId: user.id, neonSessionId: tag },
        });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("Expected a CRMS handoff");
        const target = new URL(result.redirectTo);
        expect(`${target.origin}${target.pathname}`).toBe(redirectUri);
        expect(target.searchParams.get("code")).toBeTruthy();
        expect(target.searchParams.get("state")).toBe("creoms-cutover-state-0123456789");
      }
      expect(await authorizeHandoff(prismaHandoffPorts, {
        system: "CRMS", redirectUri: "https://creoms.buildwrite.me/unregistered",
        state: "creoms-cutover-state-0123456789", codeChallenge: "x".repeat(43),
        codeChallengeMethod: "S256", subject: { userId: user.id, neonSessionId: tag },
      })).toEqual({ ok: false, error: "invalid_request", status: 400 });
      expect(await prisma.handoffCode.count({ where: { userId: user.id } })).toBe(2);
    } finally {
      const user = await prisma.user.findUnique({ where: { username: bootstrap.username } });
      if (user) {
        await prisma.handoffCode.deleteMany({ where: { userId: user.id } });
        await prisma.accessGrant.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.usernameSequence.deleteMany({ where: { year: 2098 } });
      await prisma.$disconnect();
    }
  });
});
