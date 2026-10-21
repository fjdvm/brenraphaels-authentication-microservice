import { z } from "zod";

import type { AuditEventInput } from "@/lib/audit/events";
import type { FieldErrors } from "@/lib/validations/user";

export type AccessStore = {
  findUser(id: string): Promise<{ id: string; roleId: string; isDeleted: boolean } | null>;
  roleExists(roleId: string): Promise<boolean>;
  /** How many of the given Module ids exist. */
  countModules(moduleIds: string[]): Promise<number>;
  /**
   * One transaction: set the Role, revoke active grants missing from `moduleIds`
   * (keeping them as history) and create grants for newly checked Modules. Never
   * leaves two active grants for one User and Module, even under concurrent calls.
   */
  apply(input: {
    userId: string;
    roleId: string;
    moduleIds: string[];
    actorId: string;
  }): Promise<{
    roleChange: { from: string; to: string } | null;
    granted: number;
    revoked: number;
  }>;
};

export type AccessPorts = {
  store: AccessStore;
  audit(event: AuditEventInput): Promise<void>;
};

export type UpdateAccessInput = {
  userId: string;
  roleId: string;
  moduleIds: string[];
};

export type UpdateAccessResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const updateAccessSchema = z.object({
  userId: z.string().trim().min(1),
  roleId: z.string().trim().min(1, "Choose a Role."),
  moduleIds: z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]),
});

const plural = (count: number) => `${count} Module${count === 1 ? "" : "s"}`;

/**
 * Applies the Administrator's Module checkboxes and Role to an existing User. The
 * submitted Modules are the User's complete desired access; a Role change never
 * touches grants, because only AccessGrants decide access.
 */
export async function updateUserAccess(
  input: UpdateAccessInput,
  administrator: { id: string },
  ports: AccessPorts,
): Promise<UpdateAccessResult> {
  const { store, audit } = ports;
  const actorId = administrator.id;
  // Only a User that exists may be the log target; an unknown id would break the audit foreign key.
  let targetUserId: string | null = null;
  const fail = async (
    detail: string,
    error: string,
    fieldErrors?: FieldErrors,
  ): Promise<UpdateAccessResult> => {
    await audit({ action: "user.access_update", outcome: "FAILURE", actorId, targetUserId, detail });
    return { ok: false, error, fieldErrors };
  };

  const parsed = updateAccessSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Invalid access update", "Check the highlighted fields and try again.", {
      roleId: "Choose a Role.",
    });
  }

  const { userId, roleId, moduleIds } = parsed.data;
  const user = await store.findUser(userId);
  targetUserId = user ? user.id : null;

  if (!user) {
    return fail("User not found", "That User no longer exists.");
  }

  if (user.isDeleted) {
    return fail("User is Deleted", "A Deleted User's access cannot be changed. Restore them first.");
  }

  const fieldErrors: FieldErrors = {};

  if (!(await store.roleExists(roleId))) {
    fieldErrors.roleId = "Choose a valid Role.";
  }

  if (moduleIds.length > 0 && (await store.countModules(moduleIds)) !== moduleIds.length) {
    fieldErrors.moduleIds = "One of the selected Modules no longer exists. Reload and select again.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Invalid Role or Module selection", "Check the highlighted fields and try again.", fieldErrors);
  }

  let outcome: Awaited<ReturnType<AccessStore["apply"]>>;

  try {
    outcome = await store.apply({ userId, roleId, moduleIds, actorId });
  } catch (error) {
    console.error("Could not save User access", error);
    return fail("Saving access failed", "The changes were not saved. Reload the page and try again.");
  }

  const log = (action: AuditEventInput["action"], detail: string) =>
    audit({ action, outcome: "SUCCESS", actorId, targetUserId: userId, detail });

  if (outcome.granted > 0) await log("access.grant", `${plural(outcome.granted)} granted`);
  if (outcome.revoked > 0) await log("access.revoke", `${plural(outcome.revoked)} revoked`);
  if (outcome.roleChange) {
    await log("user.role_change", `${outcome.roleChange.from} → ${outcome.roleChange.to}`);
  }

  return { ok: true };
}
