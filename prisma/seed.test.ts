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
  isDeleted?: boolean;
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
    async upsertModule(systemId, name, formerName) {
      const key = `${systemId}:${name}`;
      const formerKey = `${systemId}:${formerName}`;
      if (formerName && !modules.has(key) && modules.has(formerKey)) {
        // Mirrors the real store: rename in place so the id, and every grant on it, carries over.
        modules.set(key, modules.get(formerKey)!);
        modules.delete(formerKey);
      }
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
    async findAdministratorUsers() {
      return [...users.values()].filter((user) =>
        !user.isDeleted && roles.get(user.roleName)?.isAdministrator,
      );
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

  it("registers IMS's seven sidebar Modules and exact production and HTTPS dev callbacks", () => {
    const ims = SEED_SYSTEMS.find((system) => system.name === "IMS");
    expect(ims?.url).toBe("https://br-sims.vercel.app");
    expect(ims?.callbackUrls).toEqual([
      "https://localhost:3003/api/portal/callback",
      "https://br-sims.vercel.app/api/portal/callback",
    ]);
    expect(ims?.modules).toEqual([
      "Dashboard", "Resources & Suppliers", "Orders & Procurement", "Goods Receiving",
      "Inventory", "Production & Quality", "Stock Transfer",
    ]);
  });

  it("renames IMS placeholders in place, preserving Staff grants and templates on repeat seeding", async () => {
    const stores = createStores();
    stores.systems.set("IMS", "system-ims");
    const renames = [
      ["Inventory Module", "Inventory", "old-inventory"],
      ["Production and Quality", "Production & Quality", "old-production"],
      ["Distribution", "Stock Transfer", "old-distribution"],
    ];
    for (const [former, , id] of renames) {
      stores.modules.set(`system-ims:${former}`, id);
      stores.accessGrants.add(`staff:${id}`);
      stores.accessTemplates.add(`manager:${id}`);
    }
    const admin = {
      username: "2026-ADMIN-001", firstName: "Test", lastName: "Admin",
      email: "admin@example.test", password: "not-a-real-password",
    };
    await seedPortal(stores.portal, stores.auth, admin);
    await seedPortal(stores.portal, stores.auth, admin);
    for (const [former, current, id] of renames) {
      expect(stores.modules.has(`system-ims:${former}`)).toBe(false);
      expect(stores.modules.get(`system-ims:${current}`)).toBe(id);
      expect(stores.accessGrants.has(`staff:${id}`)).toBe(true);
      expect(stores.accessTemplates.has(`manager:${id}`)).toBe(true);
    }
    expect([...stores.modules.keys()].filter((key) => key.startsWith("system-ims:"))).toHaveLength(7);
  });

  it("fills IMS grants for every existing active Administrator, without granting Staff or other Systems", async () => {
    const stores = createStores();
    for (const [username, roleName, isDeleted] of [
      ["existing-ceo", "CEO", false], ["existing-admin", "Super Admin", false],
      ["staff", "Staff/Employee", false], ["deleted-admin", "CEO", true],
    ] as const) {
      stores.users.set(username, {
        id: username, username, roleName, isDeleted, email: `${username}@example.test`,
        neonAuthUserId: username, mustChangePassword: false,
      });
    }
    stores.systems.set("IMS", "system-ims");
    stores.modules.set("system-ims:Inventory Module", "old-inventory");
    stores.accessGrants.add("existing-ceo:old-inventory");
    const admin = {
      username: "2026-ADMIN-001", firstName: "Test", lastName: "Admin",
      email: "admin@example.test", password: "not-a-real-password",
    };
    await seedPortal(stores.portal, stores.auth, admin);
    const once = [...stores.accessGrants].sort();
    await seedPortal(stores.portal, stores.auth, admin);
    expect([...stores.accessGrants].sort()).toEqual(once);
    for (const username of ["existing-ceo", "existing-admin"]) {
      const grantedModules = [...stores.modules.entries()]
        .filter(([, id]) => stores.accessGrants.has(`${username}:${id}`))
        .map(([name]) => name).sort();
      expect(grantedModules).toEqual([
        "system-ims:Dashboard", "system-ims:Goods Receiving", "system-ims:Inventory",
        "system-ims:Orders & Procurement", "system-ims:Production & Quality",
        "system-ims:Resources & Suppliers", "system-ims:Stock Transfer",
      ]);
    }
    expect([...stores.accessGrants].some((grant) => grant.startsWith("staff:") || grant.startsWith("deleted-admin:"))).toBe(false);
  });

  it("registers POS at its real origin with exact callbacks and leaves its Modules unchanged", () => {
    const pos = SEED_SYSTEMS.find((system) => system.name === "POS");

    expect(pos?.url).toBe("https://web-pos-alpha-vert.vercel.app");
    expect(pos?.callbackUrls).toEqual([
      "https://web-pos-alpha-vert.vercel.app/api/portal/callback",
      "https://localhost:3002/api/portal/callback",
    ]);
    expect(pos?.modules).toEqual([
      "Dashboard",
      "Sales Processing",
      "Order Management",
      "Product Management/Price Configuration",
      "Sales Report Analytics",
      "Location/Branch Management",
      "Stock Management",
    ]);
  });

  it("registers CRMS at its real origin with exact callbacks and trusts no placeholder System", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS");

    expect(crms?.url).toBe("https://epic-crms.vercel.app");
    expect(crms?.callbackUrls).toEqual([
      "https://epic-crms.vercel.app/api/portal/callback",
      "http://localhost:3000/api/portal/callback",
    ]);
    expect(
      SEED_SYSTEMS.filter(
        (system) => ["CRMS", "HRMS", "IMS", "POS"].every((name) => system.name !== name),
      ).flatMap((system) => system.callbackUrls ?? []),
    ).toEqual([]);
  });

  it("merges seeded callbacks without duplicating or dropping registered ones", () => {
    const seeded = SEED_SYSTEMS.find((system) => system.name === "CRMS")!.callbackUrls!;
    const once = mergeCallbackUrls(["https://operator.example/cb"], seeded);

    expect(once).toEqual(["https://operator.example/cb", ...seeded]);
    expect(mergeCallbackUrls(once, seeded)).toEqual(once);
  });

  it("seeds the CRMS Marketing Module, not Campaigns, and no longer describes campaigns", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS")!;

    expect(crms.modules).toContain("Marketing");
    expect(crms.modules).not.toContain("Campaigns");
    expect(crms.description).not.toMatch(/campaign/i);
  });

  it("keeps a Staff member's grant on the old Campaigns Module as Marketing, however often it is seeded", async () => {
    const stores = createStores();
    const superAdmin = {
      username: "2026-ADMIN-001",
      firstName: "Jude",
      lastName: "Nitram",
      email: "jude.nitram08@gmail.com",
      password: "not-a-real-password",
    };
    stores.systems.set("CRMS", "system-legacy");
    stores.modules.set("system-legacy:Campaigns", "module-campaigns");
    stores.accessGrants.add("staff-member:module-campaigns");

    await seedPortal(stores.portal, stores.auth, superAdmin);
    await seedPortal(stores.portal, stores.auth, superAdmin);

    expect(stores.modules.get("system-legacy:Marketing")).toBe("module-campaigns");
    expect(stores.modules.has("system-legacy:Campaigns")).toBe(false);
    expect(stores.accessGrants.has("staff-member:module-campaigns")).toBe(true);
    expect(
      [...stores.modules.keys()].filter((key) => key.endsWith(":Marketing")),
    ).toHaveLength(1);
  });

  it("seeds the HRMS Attendance Module as a rename of Attendance Biometrics", async () => {
    const stores = createStores();
    const renames: string[] = [];
    const upsertModule = stores.portal.upsertModule;
    stores.portal.upsertModule = async (systemId, name, formerName) => {
      if (formerName && ["Campaigns", "Attendance Biometrics"].includes(formerName)) renames.push(`${formerName} -> ${name}`);
      return upsertModule(systemId, name, formerName);
    };

    await seedPortal(stores.portal, stores.auth, {
      username: "2026-ADMIN-001",
      firstName: "Jude",
      lastName: "Nitram",
      email: "jude.nitram08@gmail.com",
      password: "not-a-real-password",
    });

    expect(renames).toEqual(["Campaigns -> Marketing", "Attendance Biometrics -> Attendance"]);
    expect(SEED_SYSTEMS.find((system) => system.name === "HRMS")?.modules).toContain("Attendance");
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
        "Marketing",
      ]),
    );
  });
});
