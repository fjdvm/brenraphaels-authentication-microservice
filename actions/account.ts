"use server";

import type { FormState } from "@/actions/auth";
import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { auth } from "@/lib/auth/server";
import { requirePortalUser } from "@/lib/auth/session";
import { changePasswordSchema, firstError } from "@/lib/validations/auth";

/**
 * Change password for a signed-in User (Member "Change password" screen). Other devices are
 * signed out; this one stays signed in. The temporary-password flow keeps its own action.
 */
export async function updatePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePortalUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { error } = await auth.changePassword({
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.password,
    revokeOtherSessions: true,
  });

  if (error) {
    await recordAuditEvent({
      action: "auth.password_change",
      outcome: "FAILURE",
      actorId: user.id,
      targetUserId: user.id,
      detail: "Current password incorrect",
    });
    return { error: "Your current password is incorrect." };
  }

  await recordAuditEvent({
    action: "auth.password_change",
    outcome: "SUCCESS",
    actorId: user.id,
    targetUserId: user.id,
  });

  return { error: null, message: "Your password was updated." };
}
