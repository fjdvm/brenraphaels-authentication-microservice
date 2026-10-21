import { describe, expect, it } from "vitest";

import type { SystemLogEventInput } from "@/lib/audit/system-log";

import { changeUserLifecycle, type LifecycleStore } from "./user-lifecycle";

type Row = {
  id: string;
  username: string;
  email: string;
  isAdministrator: boolean;
  roleName?: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  mustChangePassword: boolean;
  neonAuthUserId: string;
  grants: { moduleId: string; revokedAt: Date | null }[];
};

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    username: `2026-XX-${id}`,
    email: `${id}@example.com`,
    isAdministrator: false,
    isDeleted: false,
    deletedAt: null,
    mustChangePassword: false,
    neonAuthUserId: `auth-${id}`,
    grants: [
      { moduleId: "m1", revokedAt: null },
      { moduleId: "m2", revokedAt: new Date("2026-01-01") },
    ],
    ...overrides,
  };
}

function world(rows: Row[]) {
  const events: SystemLogEventInput[] = [];
  const store: LifecycleStore = {
    async findActor(id) {
      const user = rows.find((r) => r.id === id);
      return user ? { isAdministrator: user.isAdministrator, isDeleted: user.isDeleted } : null;
    },
    async findTarget(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async setDeleted(id, deleted) {
      const user = rows.find((r) => r.id === id);
      if (!user || user.isDeleted === deleted) return false;
      user.isDeleted = deleted;
      user.deletedAt = deleted ? new Date() : null;
      return true;
    },
  };
  const ports = { store, audit: async (event: SystemLogEventInput) => void events.push(event) };
  return { rows, events, ports };
}

const admin = () => row("admin", { isAdministrator: true });

describe("changeUserLifecycle", () => {
  it("never deletes a Super Admin, even for another Administrator, and logs the refusal", async () => {
    const superAdmin = row("root", { isAdministrator: true, roleName: "Super Admin" });
    const { ports, events } = world([row("ceo", { isAdministrator: true, roleName: "CEO" }), superAdmin]);

    const result = await changeUserLifecycle("delete", "root", "ceo", ports);

    expect(result).toEqual({ ok: false, error: "A Super Admin cannot be deleted." });
    expect(superAdmin.isDeleted).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({ action: "user.delete", outcome: "FAILURE", actorId: "ceo", targetUserId: "root" }),
    ]);
  });

  it("deletes a User, keeping identity, password state and every AccessGrant", async () => {
    const target = row("u1", { mustChangePassword: true });
    const before = structuredClone(target);
    const { ports, events } = world([admin(), target]);

    const result = await changeUserLifecycle("delete", "u1", "admin", ports);

    expect(result).toEqual({ ok: true, username: "2026-XX-u1" });
    expect(target.isDeleted).toBe(true);
    expect(target.deletedAt).toBeInstanceOf(Date);
    expect({ ...target, isDeleted: false, deletedAt: null }).toEqual(before);
    expect(events).toEqual([
      expect.objectContaining({ action: "user.delete", outcome: "SUCCESS", actorId: "admin", targetUserId: "u1" }),
    ]);
  });

  it.each([true, false])(
    "restores the same User unchanged when mustChangePassword is %s",
    async (mustChangePassword) => {
      const target = row("u1", { mustChangePassword, isDeleted: true, deletedAt: new Date() });
      const before = structuredClone(target);
      const { ports, events } = world([admin(), target]);

      const result = await changeUserLifecycle("restore", "u1", "admin", ports);

      expect(result.ok).toBe(true);
      expect(target.isDeleted).toBe(false);
      expect(target.deletedAt).toBeNull();
      expect(target.mustChangePassword).toBe(mustChangePassword);
      expect({ ...target, isDeleted: true, deletedAt: before.deletedAt }).toEqual(before);
      expect(events[0]).toMatchObject({ action: "user.restore", outcome: "SUCCESS", targetUserId: "u1" });
    },
  );

  it("refuses a non-Administrator, a demoted actor and a Deleted Administrator, and logs the failure", async () => {
    for (const actor of [
      row("a", { isAdministrator: false }),
      row("a", { isAdministrator: true, isDeleted: true }),
    ]) {
      const target = row("u1");
      const { ports, events } = world([actor, target]);

      const result = await changeUserLifecycle("delete", "u1", "a", ports);

      expect(result.ok).toBe(false);
      expect(target.isDeleted).toBe(false);
      expect(events).toEqual([expect.objectContaining({ action: "user.delete", outcome: "FAILURE" })]);
    }
  });

  it("refuses an unknown actor without recording an actor id", async () => {
    const { ports, events } = world([row("u1")]);

    expect((await changeUserLifecycle("delete", "u1", "ghost", ports)).ok).toBe(false);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", actorId: null });
  });

  it("does not let an Administrator delete themselves", async () => {
    const self = admin();
    const { ports, events } = world([self]);

    expect((await changeUserLifecycle("delete", "admin", "admin", ports)).ok).toBe(false);
    expect(self.isDeleted).toBe(false);
    expect(events[0]).toMatchObject({ outcome: "FAILURE" });
  });

  it("reports a truthful failure for a missing or already-in-state target", async () => {
    const deleted = row("u2", { isDeleted: true });
    const { ports, events } = world([admin(), row("u1"), deleted]);

    expect((await changeUserLifecycle("delete", "nope", "admin", ports)).ok).toBe(false);
    expect((await changeUserLifecycle("delete", "u2", "admin", ports)).ok).toBe(false);
    expect((await changeUserLifecycle("restore", "u1", "admin", ports)).ok).toBe(false);
    expect(events.map((event) => event.outcome)).toEqual(["FAILURE", "FAILURE", "FAILURE"]);
    expect(events[0].targetUserId).toBeNull();
    expect(events[1].targetUserId).toBe("u2");
  });

  it("reports failure when a concurrent request already changed the state", async () => {
    const target = row("u1");
    const { ports, events } = world([admin(), target]);
    ports.store.setDeleted = async () => false;

    expect((await changeUserLifecycle("delete", "u1", "admin", ports)).ok).toBe(false);
    expect(events).toEqual([expect.objectContaining({ outcome: "FAILURE" })]);
  });
});
