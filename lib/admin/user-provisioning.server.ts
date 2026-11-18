import "server-only";

import { Prisma } from "@prisma/client";

import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { createNeonAuthIdentityProvisioner } from "@/lib/auth/identity-provisioner";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { prisma } from "@/lib/db/prisma";
import { managementBlocked } from "./management-module.server";
import { createSmtpCredentialsMailer } from "@/lib/email/credentials-mailer";
import { generateUsername } from "@/lib/generate-username";
import { incrementUsernameSequence, usernameYear } from "@/lib/username-sequence";

import {
  DuplicateEmailError,
  type ProvisioningPorts,
  type ProvisioningStore,
} from "./user-provisioning";

function isEmailCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("email")
  );
}

export const prismaProvisioningStore: ProvisioningStore = {
  async emailExists(email) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    return existing !== null;
  },

  async roleExists(roleId) {
    return (await prisma.role.count({ where: { id: roleId } })) === 1;
  },

  managementBlocked,

  countModules(moduleIds) {
    return prisma.module.count({ where: { id: { in: moduleIds }, retiredAt: null } });
  },

  async createUser(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        return insertProvisionedUser(transaction, input);
      });
    } catch (error) {
      throw isEmailCollision(error) ? new DuplicateEmailError() : error;
    }
  },

  // Only ever called to roll back a User who never became Active (credentials email
  // failed), so no real grant history is erased.
  async discardUser(id) {
    await prisma.$transaction([
      prisma.accessGrant.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
  },
};

export function createProductionProvisioningPorts(): ProvisioningPorts {
  return {
    store: prismaProvisioningStore,
    identity: createNeonAuthIdentityProvisioner(),
    mailer: createSmtpCredentialsMailer(),
    audit: recordAuditEvent,
    generatePassword: generateTemporaryPassword,
  };
}

/** Shared atomic User/Username/grant insert for request fulfillment. */
export async function insertProvisionedUser(transaction: Prisma.TransactionClient, input: Parameters<ProvisioningStore["createUser"]>[0]) {
  const sequenceNumber = await incrementUsernameSequence(transaction, usernameYear());
  const username = generateUsername(
    usernameYear(),
    input.firstName,
    input.lastName,
    sequenceNumber,
  );

  const user = await transaction.user.create({
    data: {
      username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: input.roleId,
      neonAuthUserId: input.neonAuthUserId,
      mustChangePassword: true,
    },
    select: { id: true },
  });

  await transaction.accessGrant.createMany({
    data: input.moduleIds.map((moduleId) => ({
      userId: user.id,
      moduleId,
      grantedBy: input.grantedBy,
    })),
  });

  const systems = await transaction.system.findMany({
    where: { modules: { some: { id: { in: input.moduleIds } } } },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return { id: user.id, username, systemNames: systems.map((system) => system.name) };
}
