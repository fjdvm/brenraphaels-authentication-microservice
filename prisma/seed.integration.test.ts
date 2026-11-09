import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { SEED_ROLES, SEED_SYSTEMS } from "../lib/seed-data";

const testDatabaseUrl = process.env.SEED_TEST_DATABASE_URL;
const testAuthBaseUrl = process.env.SEED_TEST_AUTH_BASE_URL;

const testEnvironment =
  testDatabaseUrl && testAuthBaseUrl
    ? {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        DIRECT_URL: testDatabaseUrl,
        NEON_AUTH_BASE_URL: testAuthBaseUrl,
      }
    : null;

function run(command: string, arguments_: string[]): void {
  execFileSync(command, arguments_, {
    cwd: process.cwd(),
    env: testEnvironment ?? undefined,
    stdio: "inherit",
  });
}

describe.skipIf(!testEnvironment)("the disposable Neon branch seed", () => {
  it("persists an idempotent bootstrap Super Admin", { timeout: 120_000 }, async () => {
    run("npx", ["prisma", "migrate", "deploy"]);
    run("npm", ["run", "db:seed"]);

    const sql = neon(testDatabaseUrl!);
    const [firstPassword] = await sql`
      SELECT account.password
      FROM neon_auth.account AS account
      JOIN neon_auth."user" AS auth_user ON auth_user.id = account."userId"
      WHERE lower(auth_user.email) = lower(${process.env.SEED_SUPERADMIN_EMAIL!})
        AND account."providerId" = 'credential'
    `;

    run("npm", ["run", "db:seed"]);

    const moduleCount = SEED_SYSTEMS.reduce(
      (count, system) => count + system.modules.length,
      0,
    );
    const [outcomes] = await sql`
      SELECT
        (SELECT count(*)::int FROM "Role") AS roles,
        (SELECT count(*)::int FROM "System") AS systems,
        (SELECT count(*)::int FROM "Module") AS modules,
        (SELECT count(*)::int FROM "AccessTemplate") AS access_templates,
        (SELECT count(*)::int FROM "User" WHERE username = ${process.env.SEED_SUPERADMIN_USERNAME!} AND "mustChangePassword" = false) AS super_admins,
        (SELECT count(*)::int FROM "AccessGrant" WHERE "revokedAt" IS NULL) AS active_access_grants,
        (SELECT "lastNumber" FROM "UsernameSequence" WHERE year = 2026) AS username_sequence,
        (SELECT count(*)::int FROM neon_auth."user" WHERE lower(email) = lower(${process.env.SEED_SUPERADMIN_EMAIL!}) AND role = 'admin' AND "emailVerified") AS verified_admin_auth_users,
        (SELECT email_and_password->>'disableSignUp' FROM neon_auth.project_config) AS sign_up_disabled,
        (SELECT count(*)::int FROM neon_auth.project_config, jsonb_array_elements(COALESCE(social_providers, '[]'::jsonb)) provider WHERE provider->>'id' = 'google' AND COALESCE((provider->>'isShared')::boolean, false)) AS shared_google_providers,
        (SELECT account.password FROM neon_auth.account AS account JOIN neon_auth."user" AS auth_user ON auth_user.id = account."userId" WHERE lower(auth_user.email) = lower(${process.env.SEED_SUPERADMIN_EMAIL!}) AND account."providerId" = 'credential') AS second_password
    `;

    expect(outcomes).toMatchObject({
      roles: SEED_ROLES.length,
      systems: SEED_SYSTEMS.length,
      modules: moduleCount,
      access_templates: moduleCount * 2,
      super_admins: 1,
      active_access_grants: moduleCount,
      username_sequence: 1,
      verified_admin_auth_users: 1,
      sign_up_disabled: "true",
      shared_google_providers: 0,
      second_password: firstPassword.password,
    });
  });

  it("renames a legacy SCMS System to IMS in place, by migration or by seed", { timeout: 120_000 }, async () => {
    const sql = neon(testDatabaseUrl!);

    async function imsState() {
      return sql`
        SELECT
          (SELECT count(*)::int FROM "System" WHERE name IN ('SCMS', 'IMS')) AS systems,
          (SELECT count(*)::int FROM "System" WHERE name = 'SCMS') AS legacy_systems,
          (SELECT id FROM "System" WHERE name IN ('SCMS', 'IMS')) AS system_id,
          (SELECT count(*)::int FROM "Module" AS m JOIN "System" AS s ON s.id = m."systemId" WHERE s.name IN ('SCMS', 'IMS')) AS modules,
          (SELECT count(*)::int FROM "AccessGrant" AS g JOIN "Module" AS m ON m.id = g."moduleId" JOIN "System" AS s ON s.id = m."systemId" WHERE s.name IN ('SCMS', 'IMS')) AS grants,
          (SELECT count(*)::int FROM "Role" WHERE name IN ('SCMS Manager', 'IMS Manager')) AS manager_roles
      ` as unknown as Promise<Record<string, unknown>[]>;
    }

    async function restoreLegacyNames() {
      await sql`UPDATE "System" SET name = 'SCMS' WHERE name = 'IMS'`;
      await sql`UPDATE "Role" SET name = 'SCMS Manager' WHERE name = 'IMS Manager'`;
    }

    // Revoked history on a Module must survive the rename.
    await sql`
      UPDATE "AccessGrant" SET "revokedAt" = now()
      WHERE id = (
        SELECT g.id FROM "AccessGrant" AS g
        JOIN "Module" AS m ON m.id = g."moduleId"
        JOIN "System" AS s ON s.id = m."systemId"
        WHERE s.name = 'IMS' ORDER BY g.id LIMIT 1
      )
    `;
    const [before] = await imsState();
    await restoreLegacyNames();

    // Path 1: the migration statements, run against a legacy-named database.
    const migration = readFileSync(
      "prisma/migrations/20261006000000_rename_scms_to_ims/migration.sql",
      "utf8",
    );
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
      await sql.query(statement);
    }
    const [afterMigration] = await imsState();
    expect(afterMigration).toEqual({ ...before, legacy_systems: 0 });
    await sql.query(migration.split(";")[0]);
    expect(await imsState()).toEqual([afterMigration]);

    // Path 2: the seed, run against a legacy-named database, twice.
    await restoreLegacyNames();
    run("npm", ["run", "db:seed"]);
    run("npm", ["run", "db:seed"]);
    const [afterSeed] = await imsState();
    expect(afterSeed).toEqual(afterMigration);

    const [revoked] = await sql`
      SELECT count(*)::int AS revoked FROM "AccessGrant" WHERE "revokedAt" IS NOT NULL
    `;
    expect(revoked.revoked).toBeGreaterThanOrEqual(1);

    // Leave the shared branch as found: re-activate the grant revoked above.
    await sql`UPDATE "AccessGrant" SET "revokedAt" = NULL WHERE "revokedAt" IS NOT NULL`;
  });
});
