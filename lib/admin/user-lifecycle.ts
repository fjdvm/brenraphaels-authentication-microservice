import type { SystemLogEventInput } from "@/lib/audit/system-log";

export type LifecycleAction = "delete" | "restore";

export type LifecycleStore = {
  /** The acting User as stored right now, so a demoted or Deleted actor is refused. */
  findActor(id: string): Promise<{ isAdministrator: boolean; isDeleted: boolean } | null>;
  findTarget(id: string): Promise<{ username: string; isDeleted: boolean } | null>;
  /**
   * Flips only the deletion state (and deletedAt), only if the User is currently in
   * the opposite state. Returns false when nothing changed. Identity, password state
   * and AccessGrants are never touched.
   */
  setDeleted(id: string, deleted: boolean): Promise<boolean>;
};

export type LifecyclePorts = {
  store: LifecycleStore;
  audit(event: SystemLogEventInput): Promise<void>;
};

export type LifecycleResult = { ok: true; username: string } | { ok: false; error: string };

const COPY = {
  delete: { audit: "user.delete", done: "Deleted" },
  restore: { audit: "user.restore", done: "Restored" },
} as const;

/** Deletes or restores a User. Authority is re-checked here, not trusted from the caller. */
export async function changeUserLifecycle(
  action: LifecycleAction,
  targetId: string,
  administratorId: string,
  { store, audit }: LifecyclePorts,
): Promise<LifecycleResult> {
  const copy = COPY[action];
  const fail = async (error: string, detail: string, known = true): Promise<LifecycleResult> => {
    await audit({
      action: copy.audit,
      outcome: "FAILURE",
      actorId: known ? administratorId : null,
      targetUserId: targetId,
      detail,
    });
    return { ok: false, error };
  };

  const actor = await store.findActor(administratorId);

  if (!actor || actor.isDeleted || !actor.isAdministrator) {
    return fail("You are not allowed to manage Users.", "Actor is not an eligible Administrator", actor !== null);
  }

  if (action === "delete" && targetId === administratorId) {
    return fail("You cannot delete your own User.", "Attempted to delete own User");
  }

  const target = await store.findTarget(targetId);

  if (!target) {
    return fail("That User no longer exists.", "Target User not found");
  }

  const wantsDeleted = action === "delete";

  if (target.isDeleted === wantsDeleted || !(await store.setDeleted(targetId, wantsDeleted))) {
    return fail(
      `${target.username} is already ${wantsDeleted ? "deleted" : "active"}.`,
      `${target.username} was already ${wantsDeleted ? "Deleted" : "not Deleted"}`,
    );
  }

  await audit({
    action: copy.audit,
    outcome: "SUCCESS",
    actorId: administratorId,
    targetUserId: targetId,
    detail: `${copy.done} ${target.username}`,
  });

  return { ok: true, username: target.username };
}
