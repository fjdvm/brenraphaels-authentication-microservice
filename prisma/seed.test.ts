import { describe, expect, it } from "vitest";

import {
  seedPortal,
  type SeedAuthStore,
  type SeedPortalStore,
} from "./seed";

import { SEED_ROLES, SEED_SYSTEMS } from "../lib/seed-data";

type StoredUser = {
  id: string;
  username: string;
  email: string;
  roleName: string;
  neonAuthUserId: string;
  mustChangePassword: boolean;
};

function createStores() {
  const roles = new Map<string, { id: string; isAdministrator: boolean }>();
  const systems = new Map<string, string>();
  const modules = new Map<string, string>();
  const accessTemplates = new Set<string>();
  const users = new Map<string, StoredUser>();
  const accessGrants = new Set<string>();
  const sequences = new Map<number, number>();
  const authUsers = new Map<string, { id: string; password: string }>();

  const portal: SeedPortalStore = {
    async upsertRole(name, isAdministrator) {
      const existing = roles.get(name);
      if (existing) return existing;
      const role = { id: `role-${roles.size + 1}`, isAdministrator };
      roles.set(name, role);
      return role;
    },
    async upsertSystem(system) {
      const id = systems.get(system.name) ?? `system-${systems.size + 1}`;
      systems.set(system.name, id);
      return { id };
    },
    async upsertModule(systemId, name) {
      const key = `${systemId}:${name}`;
      const id = modules.get(key) ?? `module-${modules.size + 1}`;
      modules.set(key, id);
      return { id };
    },
    async upsertAccessTemplate(roleId, moduleId) {
      accessTemplates.add(`${roleId}:${moduleId}`);
    },
    async upsertUser(user) {
      const roleName = [...roles.entries()].find(
        ([, role]) => role.id === user.roleId,
      )?.[0];
      if (!roleName) throw new Error("Unknown Role");
      const stored = { id: "portal-user", ...user, roleName };
      users.set(user.username, stored);
      return { id: stored.id };
    },
    async upsertAccessGrant(userId, moduleId) {
      accessGrants.add(`${userId}:${moduleId}`);
    },
    async setUsernameSequence(year, lastNumber) {
      sequences.set(year, lastNumber);
    },
  };

  const auth: SeedAuthStore = {
    async findUserByEmail(email) {
      return authUsers.get(email) ?? null;
    },
    async createUser(user) {
      const created = { id: `auth-user-${authUsers.size + 1}`, ...user };
      authUsers.set(user.email, created);
      return created;
    },
    async ensureAdminRoleAndVerifiedEmail() {},
    async disablePublicSignUpAndGoogleSignIn() {},
  };

  return { portal, auth, roles, systems, modules, accessTemplates, users, accessGrants, sequences, authUsers };
}

describe("seedPortal", () => {
  it("persists the bootstrap Super Admin and reference data idempotently", async () => {
    const stores = createStores();
    const superAdmin = {
      username: "2026-ADMIN-001",
      firstName: "Jude",
      lastName: "Nitram",
      email: "jude.nitram08@gmail.com",
      password: "not-a-real-password",
    };

    await seedPortal(stores.portal, stores.auth, superAdmin);
    await seedPortal(stores.portal, stores.auth, superAdmin);

    const moduleCount = SEED_SYSTEMS.reduce(
      (count, system) => count + system.modules.length,
      0,
    );
    const storedUser = stores.users.get(superAdmin.username);

    expect(stores.roles).toHaveLength(SEED_ROLES.length);
    expect(stores.roles.get("Super Admin")?.isAdministrator).toBe(true);
    expect(stores.roles.get("CEO")?.isAdministrator).toBe(true);
    expect(stores.systems).toHaveLength(SEED_SYSTEMS.length);
    expect(stores.modules).toHaveLength(moduleCount);
    expect(stores.accessTemplates).toHaveLength(moduleCount);
    expect(stores.authUsers).toHaveLength(1);
    expect(stores.authUsers.get(superAdmin.email)?.password).toBe(
      superAdmin.password,
    );
    expect(storedUser).toMatchObject({
      username: superAdmin.username,
      email: superAdmin.email,
      roleName: "Super Admin",
      mustChangePassword: false,
    });
    expect(stores.accessGrants).toHaveLength(moduleCount);
    expect(stores.sequences.get(2026)).toBe(1);
  });
});
