import "server-only";

import { prisma } from "@/lib/db/prisma";

/** Read the token's owner before Neon Auth consumes it. Never trust the Email
 * carrier alone: a signature from one request can be paired with another token.
 * Neon Auth remains responsible for consuming the token and setting credentials.
 */
export async function getResetTokenUser(token: string) {
  const users = await prisma.$queryRaw<{
    id: string;
    email: string;
    isDeleted: boolean;
  }[]>`
    SELECT u.id, u.email, u."isDeleted"
    FROM neon_auth.verification v
    JOIN public."User" u ON u."neonAuthUserId" = v.value
    WHERE v.identifier = ${`reset-password:${token}`}
      AND v."expiresAt" > now()
      AND v."createdAt" > now() - interval '15 minutes'
    LIMIT 1
  `;
  return users[0] ?? null;
}
