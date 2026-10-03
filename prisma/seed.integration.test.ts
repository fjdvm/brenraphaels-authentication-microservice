import { execFileSync } from "node:child_process";

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
      access_templates: moduleCount,
      super_admins: 1,
      active_access_grants: moduleCount,
      username_sequence: 1,
      verified_admin_auth_users: 1,
      sign_up_disabled: "true",
      shared_google_providers: 0,
      second_password: firstPassword.password,
    });
  });
});
