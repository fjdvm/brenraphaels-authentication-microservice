import "server-only";

import { recordSystemLogEvent } from "@/lib/audit/system-log";
import { createNeonAuthCredentialIssuer } from "@/lib/auth/identity-provisioner";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { prisma } from "@/lib/db/prisma";
import { createSmtpCredentialsMailer } from "@/lib/email/credentials-mailer";

import type { ResendPorts } from "./credential-resend";

export function createProductionResendPorts(): ResendPorts {
  return {
    store: {
      findUser(id) {
        return prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            username: true,
            firstName: true,
            email: true,
            neonAuthUserId: true,
            isDeleted: true,
            mustChangePassword: true,
          },
        });
      },
      async markAwaitingFirstLogin(id) {
        await prisma.user.update({ where: { id }, data: { mustChangePassword: true } });
      },
    },
    credentials: createNeonAuthCredentialIssuer(),
    mailer: createSmtpCredentialsMailer(),
    audit: recordSystemLogEvent,
    generatePassword: generateTemporaryPassword,
  };
}
