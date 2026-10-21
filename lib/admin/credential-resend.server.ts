import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
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
    deliveryProblem() {
      const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "NEXT_PUBLIC_APP_URL"].filter(
        (name) => !process.env[name],
      );

      return missing.length > 0 ? `Missing ${missing.join(", ")}` : null;
    },
    audit: recordAuditEvent,
    generatePassword: generateTemporaryPassword,
  };
}
