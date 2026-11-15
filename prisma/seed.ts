import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

import { mergeCallbackUrls } from "../lib/integrations/callbacks";
import {
  ADMINISTRATOR_ROLE_NAMES,
  SEED_MODULE_FORMER_NAMES,
  SEED_ROLES,
  SEED_ROLE_FORMER_NAMES,
  SEED_SYSTEMS,
  SUPER_ADMIN_ROLE_NAME,
  type SeedSystem,
} from "../lib/seed-data";

config({ path: ".env.local" });
config({ path: ".env.credentials" });

type SeedSuperAdmin = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type SeededRecord = { id: string };

export type SeedPortalStore = {
  upsertRole(name: string, isAdministrator: boolean): Promise<SeededRecord>;
  upsertSystem(system: SeedSystem): Promise<SeededRecord>;
  upsertModule(systemId: string, name: string, formerName?: string): Promise<SeededRecord>;
  findModules(): Promise<SeededRecord[]>;
  upsertAccessTemplate(roleId: string, moduleId: string): Promise<void>;
  upsertUser(user: Omit<SeedSuperAdmin, "password"> & { roleId: string; neonAuthUserId: string; mustChangePassword: boolean }): Promise<SeededRecord>;
  upsertAccessGrant(userId: string, moduleId: string): Promise<void>;
  findAdministratorUsers(): Promise<SeededRecord[]>;
  setUsernameSequence(year: number, lastNumber: number): Promise<void>;
};

export type SeedAuthStore = {
  findUserByEmail(email: string): Promise<SeededRecord | null>;
  createUser(user: Pick<SeedSuperAdmin, "email" | "firstName" | "lastName" | "password">): Promise<SeededRecord>;
  ensureAdminRoleAndVerifiedEmail(userId: string): Promise<void>;
  disablePublicSignUpAndGoogleSignIn(): Promise<void>;
};

function yearFromUsername(username: string): number {
  const match = /^(\d{4})-ADMIN-001$/.exec(username);

  if (!match) {
    throw new Error("SEED_SUPERADMIN_USERNAME must be YYYY-ADMIN-001.");
  }

  return Number(match[1]);
}

export async function seedPortal(
  portal: SeedPortalStore,
  auth: SeedAuthStore,
  superAdmin: SeedSuperAdmin,
): Promise<void> {
  const roles = new Map<string, SeededRecord>();

  for (const roleName of SEED_ROLES) {
    roles.set(
      roleName,
      await portal.upsertRole(
        roleName,
        ADMINISTRATOR_ROLE_NAMES.includes(roleName),
      ),
    );
  }

  const modules: SeededRecord[] = [];
  const imsModules: SeededRecord[] = [];
  for (const system of SEED_SYSTEMS) {
    const seededSystem = await portal.upsertSystem(system);

    for (const moduleName of system.modules) {
      const seededModule = await portal.upsertModule(
        seededSystem.id,
        moduleName,
        SEED_MODULE_FORMER_NAMES[system.name]?.[moduleName],
      );
      modules.push(seededModule);
      if (system.name === "IMS") imsModules.push(seededModule);
      if (system.name === "CRMS") {
        const staffModules = ["Dashboard", "Customer Profiles", "Orders", "Senior/PWD", "Payments", "Fulfilment", "Returns", "Tickets", "Feedback"];
        for (const roleName of ["CEO", "CRMS Manager", ...(staffModules.includes(moduleName) ? ["Staff/Employee"] : [])]) {
          const role = roles.get(roleName);
          if (role) await portal.upsertAccessTemplate(role.id, seededModule.id);
        }
      }
    }
  }

  const superAdminRole = roles.get(SUPER_ADMIN_ROLE_NAME);
  if (!superAdminRole) {
    throw new Error("The Super Admin Role was not seeded.");
  }

  for (const seededModule of modules) {
    await portal.upsertAccessTemplate(superAdminRole.id, seededModule.id);
  }

  await seedGeneralManager(portal);

  let authUser = await auth.findUserByEmail(superAdmin.email);
  if (!authUser) {
    authUser = await auth.createUser(superAdmin);
  }
  await auth.ensureAdminRoleAndVerifiedEmail(authUser.id);

  const user = await portal.upsertUser({
    username: superAdmin.username,
    firstName: superAdmin.firstName,
    lastName: superAdmin.lastName,
    email: superAdmin.email,
    roleId: superAdminRole.id,
    neonAuthUserId: authUser.id,
    mustChangePassword: false,
  });

  for (const seededModule of modules) {
    await portal.upsertAccessGrant(user.id, seededModule.id);
  }

  // Existing Administrator Users need IMS access at cutover, beyond the bootstrap User.
  for (const administrator of await portal.findAdministratorUsers()) {
    for (const seededModule of imsModules) {
      await portal.upsertAccessGrant(administrator.id, seededModule.id);
    }
  }

  await portal.setUsernameSequence(yearFromUsername(superAdmin.username), 1);
  await auth.disablePublicSignUpAndGoogleSignIn();
}

/** Add the new Role defaults without running bootstrap or earlier cutover backfills. */
export async function seedGeneralManager(portal: SeedPortalStore): Promise<void> {
  const role = await portal.upsertRole("General Manager", false);
  for (const seededModule of await portal.findModules()) {
    await portal.upsertAccessTemplate(role.id, seededModule.id);
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set in .env.credentials.`);
  }
  return value;
}

function superAdminFromEnvironment(): SeedSuperAdmin {
  return {
    username: requiredEnvironment("SEED_SUPERADMIN_USERNAME"),
    firstName: requiredEnvironment("SEED_SUPERADMIN_FIRST_NAME"),
    lastName: requiredEnvironment("SEED_SUPERADMIN_LAST_NAME"),
    email: requiredEnvironment("SEED_SUPERADMIN_EMAIL").toLowerCase(),
    password: requiredEnvironment("SEED_SUPERADMIN_PASSWORD"),
  };
}

export function createPortalStore(prisma: PrismaClient): SeedPortalStore {
  return {
    async upsertRole(name, isAdministrator) {
      const formerName = SEED_ROLE_FORMER_NAMES[name];
      if (formerName && !(await prisma.role.findUnique({ where: { name } }))) {
        // Keep the Role's id so existing User assignments and templates carry over.
        await prisma.role.updateMany({ where: { name: formerName }, data: { name } });
      }

      return prisma.role.upsert({
        where: { name },
        update: { isAdministrator },
        create: { name, isAdministrator },
      });
    },
    async upsertSystem(system) {
      if (system.formerName) {
        // Rename in place (keeping id, Modules and grant history) rather than
        // letting the upsert below create a second System beside the legacy one.
        const current = await prisma.system.findUnique({ where: { name: system.name } });
        const legacy = current
          ? null
          : await prisma.system.findUnique({ where: { name: system.formerName } });
        if (legacy) {
          await prisma.system.update({ where: { id: legacy.id }, data: { name: system.name } });
        }
      }

      // Callbacks are only ever added to; the backend secret is never touched, so
      // re-seeding neither duplicates a System nor resets its registration.
      const registered = await prisma.system.findUnique({
        where: { name: system.name },
        select: { callbackUrls: true },
      });
      const callbackUrls = mergeCallbackUrls(
        registered?.callbackUrls ?? [],
        system.callbackUrls ?? [],
      );

      return prisma.system.upsert({
        where: { name: system.name },
        update: {
          url: system.url,
          iconName: system.iconName,
          description: system.description,
          callbackUrls,
        },
        create: {
          name: system.name,
          url: system.url,
          iconName: system.iconName,
          description: system.description,
          callbackUrls,
        },
      });
    },
    async upsertModule(systemId, name, formerName) {
      if (formerName && !(await prisma.module.findUnique({ where: { systemId_name: { systemId, name } } }))) {
        // Keep the Module's id so existing AccessGrants and templates carry over.
        await prisma.module.updateMany({ where: { systemId, name: formerName }, data: { name } });
      }

      return prisma.module.upsert({
        where: { systemId_name: { systemId, name } },
        update: {},
        create: { systemId, name },
      });
    },
    async findModules() {
      return prisma.module.findMany({ where: { retiredAt: null }, select: { id: true } });
    },
    async upsertAccessTemplate(roleId, moduleId) {
      await prisma.accessTemplate.upsert({
        where: { roleId_moduleId: { roleId, moduleId } },
        update: {},
        create: { roleId, moduleId },
      });
    },
    async upsertUser(user) {
      return prisma.user.upsert({
        where: { username: user.username },
        update: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          neonAuthUserId: user.neonAuthUserId,
          mustChangePassword: user.mustChangePassword,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          ...user,
          isDeleted: false,
        },
      });
    },
    async upsertAccessGrant(userId, moduleId) {
      await prisma.$executeRaw`
        INSERT INTO "AccessGrant" ("id", "userId", "moduleId", "grantedBy")
        VALUES (${randomUUID()}, ${userId}, ${moduleId}, ${userId})
        ON CONFLICT DO NOTHING
      `;
    },
    async findAdministratorUsers() {
      return prisma.user.findMany({
        where: { isDeleted: false, role: { isAdministrator: true } },
        select: { id: true },
      });
    },
    async setUsernameSequence(year, lastNumber) {
      await prisma.usernameSequence.upsert({
        where: { year },
        update: { lastNumber },
        create: { year, lastNumber },
      });
    },
  };
}

function createAuthStore(databaseUrl: string, authBaseUrl: string): SeedAuthStore {
  const sql = neon(databaseUrl);
  const appOrigin = requiredEnvironment("NEXT_PUBLIC_APP_URL");

  return {
    async findUserByEmail(email) {
      const users = (await sql`
        SELECT id::text AS id
        FROM neon_auth."user"
        WHERE lower(email) = lower(${email})
      `) as { id: string }[];
      const [user] = users;
      return user ?? null;
    },
    async createUser(user) {
      const response = await fetch(
        new URL("sign-up/email", `${authBaseUrl.replace(/\/+$/, "")}/`),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: appOrigin,
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password,
            name: `${user.firstName} ${user.lastName}`,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Neon Auth could not create the Super Admin (${response.status}).`);
      }

      const created = (await response.json()) as { user?: { id?: string } };
      if (!created.user?.id) {
        throw new Error("Neon Auth did not return the created Super Admin.");
      }

      return { id: created.user.id };
    },
    async ensureAdminRoleAndVerifiedEmail(userId) {
      await sql`
        UPDATE neon_auth."user"
        SET role = 'admin', "emailVerified" = true
        WHERE id = ${userId}::uuid
      `;
    },
    async disablePublicSignUpAndGoogleSignIn() {
      await sql`
        UPDATE neon_auth.project_config
        SET email_and_password = jsonb_set(
              COALESCE(email_and_password, '{}'::jsonb),
              '{disableSignUp}',
              'true'::jsonb,
              true
            ),
            social_providers = COALESCE(
              (
                SELECT jsonb_agg(provider)
                FROM jsonb_array_elements(COALESCE(social_providers, '[]'::jsonb)) provider
                WHERE NOT (
                  provider->>'id' = 'google'
                  AND COALESCE((provider->>'isShared')::boolean, false)
                )
              ),
              '[]'::jsonb
            )
      `;
    },
  };
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnvironment("DIRECT_URL");
  const authBaseUrl = requiredEnvironment("NEON_AUTH_BASE_URL");
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });

  try {
    await seedPortal(
      createPortalStore(prisma),
      createAuthStore(databaseUrl, authBaseUrl),
      superAdminFromEnvironment(),
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
