import "server-only";
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";

import { neon } from "@neondatabase/serverless";

import type { ResendPorts } from "@/lib/admin/credential-resend";
import type { IdentityProvisioner } from "@/lib/admin/user-provisioning";

type CredentialIssuer = ResendPorts["credentials"];

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// Better Auth (which backs Neon Auth) stores credentials as `salt:key`, hex-encoded
// scrypt over the NFKC-normalised password. Matching it is what lets the User sign in
// through the SDK with the Temporary password we email them.
const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 } as const;

export async function hashCredentialPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.dkLen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });

  return `${salt}:${key.toString("hex")}`;
}

/**
 * Provisions the Neon Auth credential identity for a new User.
 *
 * Public sign-up is disabled, and Neon's own admin endpoints would need the signed-in
 * Administrator to hold a Neon `admin` Role claim, which only the bootstrap Super Admin
 * has. Portal authority comes from this portal's Roles, so a CEO must be able to create
 * Users too: the identity is therefore written straight to the Neon Auth schema. The
 * Neon role is always the plain `user`; it carries no portal authority.
 */
export function createNeonAuthIdentityProvisioner(
  connectionString = process.env.DATABASE_URL,
): IdentityProvisioner {
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to provision Neon Auth identities.");
  }

  const sql = neon(connectionString);

  return {
    async create({ email, name, password }) {
      const userId = randomUUID();
      const passwordHash = await hashCredentialPassword(password);

      // One statement, so the user and its credential exist together or not at all.
      // The WHERE NOT EXISTS keeps a repeat of the same Email from creating a duplicate.
      const created = (await sql`
        WITH new_user AS (
          INSERT INTO neon_auth."user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
          SELECT ${userId}::uuid, ${name}, ${email}, true, 'user', now(), now()
          WHERE NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE lower(email) = lower(${email}))
          RETURNING id
        ),
        new_account AS (
          INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
          SELECT ${randomUUID()}::uuid, ${userId}, 'credential', new_user.id, ${passwordHash}, now(), now()
          FROM new_user
          RETURNING "userId"
        )
        SELECT "userId"::text AS id FROM new_account
      `) as { id: string }[];

      if (!created[0]) {
        throw new Error("A Neon Auth identity already exists for this Email.");
      }

      return { id: created[0].id };
    },

    async remove(id) {
      await sql`
        WITH removed_sessions AS (
          DELETE FROM neon_auth.session WHERE "userId" = ${id}::uuid
        ),
        removed_accounts AS (
          DELETE FROM neon_auth.account WHERE "userId" = ${id}::uuid
        )
        DELETE FROM neon_auth."user" WHERE id = ${id}::uuid
      `;
    },
  };
}

/**
 * Replaces a credential identity's password and ends its sessions, so the previous
 * password and any signed-in device stop working the moment fresh credentials are issued.
 */
export function createNeonAuthCredentialIssuer(
  connectionString = process.env.DATABASE_URL,
): CredentialIssuer {
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to replace Neon Auth passwords.");
  }

  const sql = neon(connectionString);

  return {
    async replacePassword(neonAuthUserId, password) {
      const passwordHash = await hashCredentialPassword(password);

      const updated = (await sql`
        WITH updated_account AS (
          UPDATE neon_auth.account
          SET password = ${passwordHash}, "updatedAt" = now()
          WHERE "userId" = ${neonAuthUserId}::uuid AND "providerId" = 'credential'
          RETURNING "userId"
        ),
        removed_sessions AS (
          DELETE FROM neon_auth.session
          WHERE "userId" IN (SELECT "userId" FROM updated_account)
        )
        SELECT "userId"::text AS id FROM updated_account
      `) as { id: string }[];

      if (!updated[0]) {
        throw new Error("No Neon Auth credential exists for this User.");
      }
    },
  };
}
