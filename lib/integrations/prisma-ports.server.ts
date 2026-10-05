import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { HandoffPorts } from "./handoff";
import type { ValidationPorts } from "./validation";

export const prismaHandoffPorts: HandoffPorts & ValidationPorts = {
  findSystemByName: (name) =>
    prisma.system.findUnique({
      where: { name },
      select: { id: true, name: true, callbackUrls: true, backendSecretHash: true },
    }),

  async isUserEligible(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isDeleted: true, mustChangePassword: true },
    });

    return Boolean(user && !user.isDeleted && !user.mustChangePassword);
  },

  async hasActiveGrantInSystem(userId, systemId) {
    const grant = await prisma.accessGrant.findFirst({
      where: { userId, revokedAt: null, module: { systemId } },
      select: { id: true },
    });

    return grant !== null;
  },

  // Neon Auth keeps its sessions in this database. Reading the row directly is an
  // uncached source of truth: a signed-out or expired session has no live row, no
  // matter what session_data cookie any browser still holds.
  async isCentralSessionActive(neonSessionId, now) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM neon_auth.session
      WHERE id::text = ${neonSessionId} AND "expiresAt" > ${now}
      LIMIT 1
    `;

    return rows.length > 0;
  },

  async saveCode(record) {
    await prisma.handoffCode.create({ data: record });
  },

  async consumeCode(codeHash, systemId, now) {
    // The conditional UPDATE is the single-use guarantee: the database lets exactly
    // one concurrent caller flip consumedAt from NULL.
    const claimed = await prisma.handoffCode.updateMany({
      where: { codeHash, systemId, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });

    if (claimed.count !== 1) {
      return null;
    }

    return prisma.handoffCode.findUnique({
      where: { codeHash },
      select: {
        codeHash: true,
        systemId: true,
        userId: true,
        neonSessionId: true,
        redirectUri: true,
        state: true,
        codeChallenge: true,
        expiresAt: true,
      },
    });
  },

  async saveSession(record) {
    await prisma.integrationSession.create({ data: record });
  },

  findIntegrationSession: (handleHash) =>
    prisma.integrationSession.findUnique({
      where: { handleHash },
      select: {
        handleHash: true,
        systemId: true,
        userId: true,
        neonSessionId: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),

  async hasActiveGrantInModule(userId, systemId, moduleName) {
    const grant = await prisma.accessGrant.findFirst({
      where: { userId, revokedAt: null, module: { systemId, name: moduleName } },
      select: { id: true },
    });

    return grant !== null;
  },

  now: () => new Date(),
};
