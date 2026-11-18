import { describe, expect, it } from "vitest";

import {
  seedPortal,
  type SeedAuthStore,
  type SeedPortalStore,
} from "./seed";

import { mergeCallbackUrls } from "../lib/integrations/callbacks";
import { SEED_MODULE_FORMER_NAMES, SEED_ROLES, SEED_SYSTEMS } from "../lib/seed-data";

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
    async findModules() { return [...modules.entries()].map(([key, id]) => ({ id, name: key.split(":").slice(1).join(":") })); },
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
  it("persists the bootstrap Admin and reference data idempotently", async () => {
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
    expect(stores.roles.get("Admin")?.isAdministrator).toBe(true);
    expect(stores.roles.get("CEO")?.isAdministrator).toBe(true);
    expect(stores.systems).toHaveLength(SEED_SYSTEMS.length);
    expect(stores.modules).toHaveLength(moduleCount);
    expect(stores.accessTemplates).toHaveLength(moduleCount * 2 + 10 * 2 + 11);
    expect(stores.authUsers).toHaveLength(1);
    expect(stores.authUsers.get(superAdmin.email)?.password).toBe(
      superAdmin.password,
    );
    expect(storedUser).toMatchObject({
      username: superAdmin.username,
      email: superAdmin.email,
      roleName: "Admin",
      mustChangePassword: false,
    });
    // Every Module but Management, which only a Manager or the CEO may hold.
    expect(stores.accessGrants).toHaveLength(moduleCount - 1);
    const management = stores.modules.get("system-3:Management") ?? [...stores.modules.entries()].find(([key]) => key.endsWith(":Management"))?.[1];
    expect(management).toBeTruthy();
    expect([...stores.accessGrants].some((grant) => grant.endsWith(`:${management}`))).toBe(false);
    expect([...stores.accessTemplates].filter((entry) => entry.endsWith(`:${management}`))).toHaveLength(2);
    expect(stores.sequences.get(2026)).toBe(1);
  });

  it("adds General Manager after VP with every Module template and no administrative authority", async () => {
    const stores = createStores();
    stores.roles.set("Cashier", { id: "cashier", isAdministrator: false });
    stores.accessTemplates.add("cashier:custom-module");
    const admin = {
      username: "2026-ADMIN-001", firstName: "Seed", lastName: "Admin",
      email: "seed@example.test", password: "unused",
    };
    await seedPortal(stores.portal, stores.auth, admin);
    const role = stores.roles.get("General Manager");
    expect(role).toMatchObject({ isAdministrator: false });
    expect(SEED_ROLES.slice(2, 4)).toEqual(["VP", "General Manager"]);
    expect([...stores.accessTemplates].filter((entry) => entry.startsWith(`${role!.id}:`))).toHaveLength(33);
    const before = { roles: [...stores.roles], templates: [...stores.accessTemplates], users: [...stores.users], grants: [...stores.accessGrants] };
    await seedPortal(stores.portal, stores.auth, admin);
    expect({ roles: [...stores.roles], templates: [...stores.accessTemplates], users: [...stores.users], grants: [...stores.accessGrants] }).toEqual(before);
    expect(stores.accessTemplates.has("cashier:custom-module")).toBe(true);
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
      ["existing-ceo", "CEO", false], ["existing-admin", "Admin", false],
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

  it("registers POS at its real origin with exact callbacks and seeds its six Modules in POS's sidebar order", () => {
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
      "Product Management",
      "Stock Management",
      "Sales Reports",
    ]);
    expect(SEED_MODULE_FORMER_NAMES.POS).toEqual({
      "Product Management": "Product Management/Price Configuration",
      "Sales Reports": "Sales Report Analytics",
    });
  });

  it("registers CRMS at its real origin with exact callbacks and trusts no placeholder System", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS");

    expect(crms?.url).toBe("https://creoms.buildwrite.me");
    expect(crms?.callbackUrls).toEqual([
      "https://creoms.buildwrite.me/api/portal/callback",
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

  it("no longer seeds a CRMS Marketing Module and no longer describes marketing", () => {
    const crms = SEED_SYSTEMS.find((system) => system.name === "CRMS")!;

    expect(crms.modules).not.toContain("Marketing");
    expect(crms.modules).not.toContain("Campaigns");
    expect(crms.description).not.toMatch(/campaign|marketing/i);
  });

  it("keeps the other CRMS Modules, in order", () => {
    expect(SEED_SYSTEMS.find((system) => system.name === "CRMS")!.modules).toEqual([
      "Dashboard", "Customer Profiles", "Orders", "Senior/PWD", "Payments",
      "Fulfilment", "Returns", "Tickets", "Conversations", "Feedback", "Reports", "Management",
    ]);
  });

  it("seeds exactly the nine current HRMS Modules", () => {
    expect(SEED_SYSTEMS.find((system) => system.name === "HRMS")?.modules).toEqual([
      "Dashboard", "Job Postings", "Applications", "Interviews", "Offers",
      "Employee Information", "Employee Onboarding", "Training", "Performance",
    ]);
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
        "Senior/PWD",
        "Payments",
        "Fulfilment",
        "Returns",
        "Tickets",
        "Conversations",
        "Feedback",
        "Reports",
        "Management",
      ]),
    );
  });
});
