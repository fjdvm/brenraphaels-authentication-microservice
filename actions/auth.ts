"use server";

import { redirect } from "next/navigation";

import { recordSystemLogEvent } from "@/lib/audit/system-log";
import { resetLinkParams, verifyResetLinkEmail } from "@/lib/auth/reset-link";
import { auth } from "@/lib/auth/server";
import { getPortalUser, requirePasswordChangeUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  changePasswordSchema,
  firstError,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export type FormState = { error: string | null; message?: string | null };

const INVALID_CREDENTIALS: FormState = { error: "Invalid credentials" };

export async function loginAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return INVALID_CREDENTIALS;
  }

  // Users sign in with their Username; Neon Auth signs in with the linked Email.
  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username.toUpperCase() },
    select: { id: true, email: true, isDeleted: true, mustChangePassword: true },
  });

  // Same message for unknown, Deleted and wrong-password so a Username can't be probed.
  if (!user || user.isDeleted) {
    await recordSystemLogEvent({
      action: "auth.login",
      outcome: "FAILURE",
      targetUserId: user?.id,
      detail: user ? "Deleted User" : "Unknown Username",
    });
    return INVALID_CREDENTIALS;
  }

  const { error } = await auth.signIn.email({
    email: user.email,
    password: parsed.data.password,
  });

  // No actor on failure: the person was never authenticated.
  if (error) {
    await recordSystemLogEvent({
      action: "auth.login",
      outcome: "FAILURE",
      targetUserId: user.id,
      detail: "Incorrect password",
    });
    return INVALID_CREDENTIALS;
  }

  await recordSystemLogEvent({
    action: "auth.login",
    outcome: "SUCCESS",
    actorId: user.id,
    targetUserId: user.id,
  });

  redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction(): Promise<void> {
  const user = await getPortalUser();
  const { error } = (await auth.signOut()) ?? {};

  if (user) {
    await recordSystemLogEvent({
      action: "auth.logout",
      outcome: error ? "FAILURE" : "SUCCESS",
      actorId: user.id,
      targetUserId: user.id,
    });
  }

  redirect("/login");
}

export async function changePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePasswordChangeUser();

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
    await recordSystemLogEvent({
      action: "auth.password_change",
      outcome: "FAILURE",
      actorId: user.id,
      targetUserId: user.id,
      detail: "Current password incorrect",
    });
    return { error: "Your current password is incorrect." };
  }

  await recordSystemLogEvent({
    action: "auth.password_change",
    outcome: "SUCCESS",
    actorId: user.id,
    targetUserId: user.id,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { mustChangePassword: false },
  });

  redirect("/");
}

export async function forgotPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isDeleted: true },
  });

  // Only a portal User who isn't Deleted gets a link. The reply is identical either way.
  if (user && !user.isDeleted) {
    const redirectTo = new URL("/reset-password", process.env.NEXT_PUBLIC_APP_URL);
    for (const [key, value] of Object.entries(resetLinkParams(email))) {
      redirectTo.searchParams.set(key, value);
    }

    const { error } =
      (await auth.requestPasswordReset({ email, redirectTo: redirectTo.toString() })) ?? {};

    await recordSystemLogEvent({
      action: "auth.password_reset_request",
      outcome: error ? "FAILURE" : "SUCCESS",
      targetUserId: user.id,
    });
  } else {
    await recordSystemLogEvent({
      action: "auth.password_reset_request",
      outcome: "FAILURE",
      targetUserId: user?.id,
      detail: user ? "Deleted User" : "No User for that Email",
    });
  }

  return {
    error: null,
    message:
      "If a User exists for that Email, a reset link is on its way. It expires in 15 minutes.",
  };
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!formData.get("token")) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  // Only a signed link identifies whose password this is; anything else stays unattributed.
  const email = verifyResetLinkEmail(
    formData.get("e")?.toString(),
    formData.get("s")?.toString(),
  );
  const target = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;

  const { error } = await auth.resetPassword({
    newPassword: parsed.data.password,
    token: parsed.data.token,
  });

  if (error) {
    await recordSystemLogEvent({
      action: "auth.password_reset",
      outcome: "FAILURE",
      targetUserId: target?.id,
      detail: "Invalid or expired reset link",
    });
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  // Completing a reset leaves the User Active, not Awaiting first login.
  if (email) {
    await prisma.user.updateMany({
      where: { email },
      data: { mustChangePassword: false },
    });
  }

  // Holding a valid reset token proves the User, so they are the actor when the link is signed.
  await recordSystemLogEvent({
    action: "auth.password_reset",
    outcome: "SUCCESS",
    actorId: target?.id,
    targetUserId: target?.id,
  });

  redirect("/login?reset=1");
}
