import { describe, expect, it } from "vitest";

import { updateUserAccess, type AccessStore } from "./user-access";

import type { SystemLogEventInput } from "@/lib/audit/system-log";

const ADMIN = { id: "admin-1" };
const TARGET = "user-2";
const MODULES = ["m1", "m2", "m3"];

type Grant = { moduleId: string; grantedBy: string; revoked: boolean };

function createWorld(options: { deleted?: boolean; storeFails?: boolean } = {}) {
  const grants: Grant[] = [{ moduleId: "m1", grantedBy: "seed", revoked: false }];
  const user = { id: TARGET, roleId: "role-a", isDeleted: options.deleted ?? false };
  const events: SystemLogEventInput[] = [];
  const roles: Record<string, string> = { "role-a": "Cashier", "role-b": "CEO" };

  const store: AccessStore = {
    async findUser(id) {
      return id === user.id ? { ...user } : null;
    },
    async roleExists(roleId) {
      return roleId in roles;
    },
    async countModules(ids) {
      return ids.filter((id) => MODULES.includes(id)).length;
    },
    async apply({ userId, roleId, moduleIds, actorId }) {
      if (options.storeFails) throw new Error("db down");
      expect(userId).toBe(TARGET);
      const roleChange = roleId === user.roleId ? null : { from: roles[user.roleId], to: roles[roleId] };
      user.roleId = roleId;
      const active = grants.filter((grant) => !grant.revoked).map((grant) => grant.moduleId);
      const toRevoke = active.filter((id) => !moduleIds.includes(id));
      const toGrant = moduleIds.filter((id) => !active.includes(id));
      grants.forEach((grant) => {
        if (!grant.revoked && toRevoke.includes(grant.moduleId)) grant.revoked = true;
      });
      toGrant.forEach((moduleId) => grants.push({ moduleId, grantedBy: actorId, revoked: false }));
      return { roleChange, granted: toGrant.length, revoked: toRevoke.length };
    },
  };

  const ports = {
    store,
    audit: async (event: SystemLogEventInput) => {
      events.push(event);
    },
  };
  const active = () => grants.filter((grant) => !grant.revoked).map((grant) => grant.moduleId);

  return { grants, user, events, ports, active };
}

const save = (world: ReturnType<typeof createWorld>, input: Partial<{ roleId: string; moduleIds: string[] }> = {}) =>
  updateUserAccess({ userId: TARGET, roleId: "role-a", moduleIds: ["m1"], ...input }, ADMIN, world.ports);

describe("updateUserAccess", () => {
  it("grants newly checked Modules attributed to the Administrator", async () => {
    const world = createWorld();

    const result = await save(world, { moduleIds: ["m1", "m2"] });

    expect(result).toMatchObject({ ok: true });
    expect(world.active().sort()).toEqual(["m1", "m2"]);
    expect(world.grants.find((grant) => grant.moduleId === "m2")?.grantedBy).toBe("admin-1");
  });

  it("revokes unchecked Modules without deleting their history", async () => {
    const world = createWorld();

    await save(world, { moduleIds: [] });

    expect(world.active()).toEqual([]);
    expect(world.grants).toHaveLength(1);
    expect(world.grants[0].revoked).toBe(true);
  });

  it("re-granting keeps the earlier revoked grant and adds a new active one", async () => {
    const world = createWorld();

    await save(world, { moduleIds: [] });
    await save(world, { moduleIds: ["m1"] });

    expect(world.grants.filter((grant) => grant.moduleId === "m1")).toEqual([
      expect.objectContaining({ revoked: true }),
      expect.objectContaining({ revoked: false }),
    ]);
  });

  it("repeated saves create no duplicate active grants", async () => {
    const world = createWorld();

    await save(world, { moduleIds: ["m1", "m2"] });
    await save(world, { moduleIds: ["m1", "m2", "m2"] });

    expect(world.grants).toHaveLength(2);
    expect(world.active().sort()).toEqual(["m1", "m2"]);
  });

  it("changing the Role leaves the User's grants untouched", async () => {
    const world = createWorld();

    const result = await save(world, { roleId: "role-b" });

    expect(result).toMatchObject({ ok: true });
    expect(world.user.roleId).toBe("role-b");
    expect(world.active()).toEqual(["m1"]);
    expect(world.grants).toHaveLength(1);
  });

  it("logs each outcome with the Administrator as actor and the User as target", async () => {
    const world = createWorld();

    await save(world, { roleId: "role-b", moduleIds: ["m2"] });

    expect(world.events).toEqual([
      expect.objectContaining({ action: "access.grant", outcome: "SUCCESS", actorId: "admin-1", targetUserId: TARGET }),
      expect.objectContaining({ action: "access.revoke", outcome: "SUCCESS", actorId: "admin-1", targetUserId: TARGET }),
      expect.objectContaining({
        action: "user.role_change",
        outcome: "SUCCESS",
        actorId: "admin-1",
        targetUserId: TARGET,
        detail: "Cashier → CEO",
      }),
    ]);
  });

  it("logs nothing as a change when nothing changed", async () => {
    const world = createWorld();

    await save(world);

    expect(world.events).toEqual([]);
  });

  it("rejects an unknown Role or Module, changes nothing and logs a failure", async () => {
    const world = createWorld();

    const role = await save(world, { roleId: "nope" });
    const modules = await save(world, { moduleIds: ["m1", "ghost"] });

    expect(role).toMatchObject({ ok: false, fieldErrors: { roleId: expect.any(String) } });
    expect(modules).toMatchObject({ ok: false, fieldErrors: { moduleIds: expect.any(String) } });
    expect(world.active()).toEqual(["m1"]);
    expect(world.events).toEqual([
      expect.objectContaining({ action: "user.access_update", outcome: "FAILURE", actorId: "admin-1", targetUserId: TARGET }),
      expect.objectContaining({ action: "user.access_update", outcome: "FAILURE", actorId: "admin-1", targetUserId: TARGET }),
    ]);
  });

  it("refuses a missing or Deleted User", async () => {
    const missing = await updateUserAccess({ userId: "ghost", roleId: "role-a", moduleIds: [] }, ADMIN, createWorld().ports);
    const deletedWorld = createWorld({ deleted: true });
    const deleted = await save(deletedWorld, { moduleIds: [] });

    expect(missing).toMatchObject({ ok: false });
    expect(deleted).toMatchObject({ ok: false });
    expect(deletedWorld.active()).toEqual(["m1"]);
    expect(deletedWorld.events).toEqual([
      expect.objectContaining({ action: "user.access_update", outcome: "FAILURE", targetUserId: TARGET }),
    ]);
  });

  it("reports a store failure truthfully and logs it", async () => {
    const world = createWorld({ storeFails: true });

    const result = await save(world, { moduleIds: [] });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("not saved") });
    expect(world.events).toEqual([
      expect.objectContaining({ action: "user.access_update", outcome: "FAILURE", targetUserId: TARGET }),
    ]);
    expect(JSON.stringify(world.events)).not.toContain("db down");
  });
});
