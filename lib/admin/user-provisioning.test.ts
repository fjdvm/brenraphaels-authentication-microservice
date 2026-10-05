import { describe, expect, it } from "vitest";

import {
  DuplicateEmailError,
  provisionUser,
  type CredentialsMailer,
  type IdentityProvisioner,
  type ProvisioningStore,
} from "./user-provisioning";

import type { SystemLogEventInput } from "@/lib/audit/system-log";

const ADMIN = { id: "admin-1" };
const ROLE_ID = "role-cashier";
const MODULE_IDS = ["m-pos-1", "m-pos-2", "m-crms-1"];

type StoredUser = { id: string; username: string; email: string; grants: string[]; grantedBy: string };

function createWorld(options: { sendFails?: boolean; identityFails?: boolean; storeDelayMs?: number } = {}) {
  const users: StoredUser[] = [];
  const identities = new Map<string, { id: string; email: string; password: string }>();
  const sent: Parameters<CredentialsMailer["sendCredentials"]>[0][] = [];
  const events: SystemLogEventInput[] = [];
  let sequence = 0;
  const delay = () => new Promise((resolve) => setTimeout(resolve, options.storeDelayMs ?? 0));

  const store: ProvisioningStore = {
    async emailExists(email) {
      await delay();
      return users.some((user) => user.email.toLowerCase() === email.toLowerCase());
    },
    async roleExists(roleId) {
      return roleId === ROLE_ID;
    },
    async countModules(ids) {
      return ids.filter((id) => MODULE_IDS.includes(id)).length;
    },
    async createUser(input) {
      await delay();
      if (users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
        throw new DuplicateEmailError();
      }
      sequence += 1;
      const user = {
        id: `user-${sequence}`,
        username: `2026-JD-${String(sequence).padStart(3, "0")}`,
        email: input.email,
        grants: [...input.moduleIds],
        grantedBy: input.grantedBy,
      };
      users.push(user);
      return { id: user.id, username: user.username, systemNames: ["POS"] };
    },
    async discardUser(id) {
      users.splice(users.findIndex((user) => user.id === id), 1);
    },
  };

  const identity: IdentityProvisioner = {
    async create({ email, password }) {
      if (options.identityFails) throw new Error("Neon Auth is down");
      if ([...identities.values()].some((existing) => existing.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("email already registered");
      }
      const created = { id: `auth-${identities.size + 1}-${email}`, email, password };
      identities.set(created.id, created);
      return { id: created.id };
    },
    async remove(id) {
      identities.delete(id);
    },
  };

  const mailer: CredentialsMailer = {
    async sendCredentials(message) {
      if (options.sendFails) throw new Error("SMTP unreachable");
      sent.push(message);
    },
  };

  const ports = {
    store,
    identity,
    mailer,
    audit: async (event: SystemLogEventInput) => {
      events.push(event);
    },
    generatePassword: () => "Temp-Pass-123",
  };

  return { users, identities, sent, events, ports };
}

const validInput = {
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: "Juan@Example.com",
  roleId: ROLE_ID,
  moduleIds: ["m-pos-1", "m-crms-1"],
};

describe("provisionUser", () => {
  it("creates the User with only the selected Modules and emails the credentials", async () => {
    const world = createWorld();

    const result = await provisionUser(validInput, ADMIN, world.ports);

    expect(result).toMatchObject({ ok: true, user: { username: "2026-JD-001", email: "juan@example.com" } });
    expect(world.users).toHaveLength(1);
    expect(world.users[0]).toMatchObject({ grants: ["m-pos-1", "m-crms-1"], grantedBy: "admin-1" });
    expect(world.identities.size).toBe(1);
    expect(world.sent).toEqual([
      {
        to: "juan@example.com",
        firstName: "Juan",
        username: "2026-JD-001",
        temporaryPassword: "Temp-Pass-123",
      },
    ]);
  });

  it("never hands the Temporary password back to the Administrator", async () => {
    const world = createWorld();

    const result = await provisionUser(validInput, ADMIN, world.ports);

    expect(JSON.stringify(result)).not.toContain("Temp-Pass-123");
    expect(JSON.stringify(world.events)).not.toContain("Temp-Pass-123");
  });

  it("logs the creation and the initial grants", async () => {
    const world = createWorld();

    await provisionUser(validInput, ADMIN, world.ports);

    expect(world.events).toEqual([
      expect.objectContaining({ action: "user.create", outcome: "SUCCESS", actorId: "admin-1", targetUserId: "user-1" }),
      expect.objectContaining({ action: "access.grant", outcome: "SUCCESS", actorId: "admin-1", targetUserId: "user-1" }),
    ]);
  });

  it("reports actionable field errors and creates nothing when the information is invalid", async () => {
    const world = createWorld();

    const result = await provisionUser(
      { ...validInput, firstName: "", email: "not-an-email", roleId: "" },
      ADMIN,
      world.ports,
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        firstName: expect.any(String),
        email: expect.any(String),
        roleId: expect.any(String),
      },
    });
    expect(world.users).toHaveLength(0);
    expect(world.identities.size).toBe(0);
    expect(world.sent).toHaveLength(0);
  });

  it("rejects a name that cannot produce a Username initial", async () => {
    const world = createWorld();

    const result = await provisionUser({ ...validInput, lastName: "123" }, ADMIN, world.ports);

    expect(result).toMatchObject({ ok: false, fieldErrors: { lastName: expect.any(String) } });
  });

  it("rejects an Email already used, ignoring case, without touching Neon Auth", async () => {
    const world = createWorld();
    await provisionUser(validInput, ADMIN, world.ports);

    const result = await provisionUser({ ...validInput, email: "JUAN@example.COM" }, ADMIN, world.ports);

    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.stringContaining("already") } });
    expect(world.users).toHaveLength(1);
    expect(world.identities.size).toBe(1);
    expect(world.sent).toHaveLength(1);
    expect(world.events.at(-1)).toMatchObject({ action: "user.create", outcome: "FAILURE" });
  });

  it("rejects an unknown Role or Module", async () => {
    const world = createWorld();

    const role = await provisionUser({ ...validInput, roleId: "nope" }, ADMIN, world.ports);
    const modules = await provisionUser({ ...validInput, moduleIds: ["m-pos-1", "ghost"] }, ADMIN, world.ports);

    expect(role).toMatchObject({ ok: false, fieldErrors: { roleId: expect.any(String) } });
    expect(modules).toMatchObject({ ok: false, fieldErrors: { moduleIds: expect.any(String) } });
    expect(world.users).toHaveLength(0);
  });

  it("allows a User to be created with no Modules", async () => {
    const world = createWorld();

    const result = await provisionUser({ ...validInput, moduleIds: [] }, ADMIN, world.ports);

    expect(result.ok).toBe(true);
    expect(world.users[0].grants).toEqual([]);
    expect(world.events.map((event) => event.action)).toEqual(["user.create"]);
  });

  it("does not falsely report success when Neon Auth provisioning fails", async () => {
    const world = createWorld({ identityFails: true });

    const result = await provisionUser(validInput, ADMIN, world.ports);

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Nothing was created") });
    expect(world.users).toHaveLength(0);
    expect(world.sent).toHaveLength(0);
    expect(world.events).toEqual([expect.objectContaining({ action: "user.create", outcome: "FAILURE" })]);
  });

  it("rolls everything back when the email cannot be delivered, so a retry succeeds without duplicates", async () => {
    const failing = createWorld({ sendFails: true });

    const failed = await provisionUser(validInput, ADMIN, failing.ports);

    expect(failed).toMatchObject({ ok: false, error: expect.stringContaining("email") });
    expect(failing.users).toHaveLength(0);
    expect(failing.identities.size).toBe(0);
    expect(failing.events.map((event) => `${event.action}:${event.outcome}`)).toEqual(["user.create:FAILURE"]);

    // The SMTP provider recovers: same stores, working mailer.
    failing.ports.mailer = {
      async sendCredentials(message) {
        failing.sent.push(message);
      },
    };
    const retried = await provisionUser(validInput, ADMIN, failing.ports);

    expect(retried.ok).toBe(true);
    expect(failing.users).toHaveLength(1);
    expect(failing.identities.size).toBe(1);
    expect(failing.sent).toHaveLength(1);
  });

  it("removes the Neon Auth identity if the portal record cannot be saved", async () => {
    const world = createWorld();
    world.ports.store = {
      ...world.ports.store,
      createUser: async () => {
        throw new Error("database offline");
      },
    };

    const result = await provisionUser(validInput, ADMIN, world.ports);

    expect(result.ok).toBe(false);
    expect(world.identities.size).toBe(0);
    expect(world.sent).toHaveLength(0);
  });

  it("creates exactly one User when the same Email is submitted twice at once", async () => {
    const world = createWorld({ storeDelayMs: 5 });

    const [first, second] = await Promise.all([
      provisionUser(validInput, ADMIN, world.ports),
      provisionUser({ ...validInput, email: "juan@example.com" }, ADMIN, world.ports),
    ]);

    expect([first.ok, second.ok].sort()).toEqual([false, true]);
    expect(world.users).toHaveLength(1);
    expect(world.identities.size).toBe(1);
    expect(world.sent).toHaveLength(1);
  });
});
