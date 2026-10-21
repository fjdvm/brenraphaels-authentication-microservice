import { describe, expect, it } from "vitest";

import {
  seedPortal,
  type SeedAuthStore,
  type SeedPortalStore,
} from "./seed";

import { mergeCallbackUrls } from "../lib/integrations/callbacks";
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

  it("registers CRMS at its real origin with exact callbacks and trusts no placeholder System", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS");

    expect(crms?.url).toBe("https://epic-crms.vercel.app");
    expect(crms?.callbackUrls).toEqual([
      "https://epic-crms.vercel.app/api/portal/callback",
      "http://localhost:3000/api/portal/callback",
    ]);
    expect(
      SEED_SYSTEMS.filter((system) => system.name !== "CRMS").flatMap(
        (system) => system.callbackUrls ?? [],
      ),
    ).toEqual([]);
  });

  it("merges seeded callbacks without duplicating or dropping registered ones", () => {
    const seeded = SEED_SYSTEMS.find((system) => system.name === "CRMS")!.callbackUrls!;
    const once = mergeCallbackUrls(["https://operator.example/cb"], seeded);

    expect(once).toEqual(["https://operator.example/cb", ...seeded]);
    expect(mergeCallbackUrls(once, seeded)).toEqual(once);
  });

  it("seeds a Tickets Module under CRMS that CREOMS validates sessions against", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS");

    expect(crms?.modules).toContain("Tickets");
  });

  it("seeds every CRMS Module the CREOMS sidebar shows, including Feedback", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS");

    expect(crms?.modules).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Customer Profiles",
        "Orders",
        "Payments",
        "Fulfilment",
        "Returns",
        "Tickets",
        "Conversations",
        "Feedback",
        "Campaigns",
      ]),
    );
  });
});
