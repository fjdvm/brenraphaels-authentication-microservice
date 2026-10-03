"use server";

import { redirect } from "next/navigation";

import { resetLinkParams, verifyResetLinkEmail } from "@/lib/auth/reset-link";
import { auth } from "@/lib/auth/server";
import { requirePasswordChangeUser } from "@/lib/auth/session";
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
    select: { email: true, isDeleted: true, mustChangePassword: true },
  });

  // Same message for unknown, Deleted and wrong-password so a Username can't be probed.
  if (!user || user.isDeleted) {
    return INVALID_CREDENTIALS;
  }

  const { error } = await auth.signIn.email({
    email: user.email,
    password: parsed.data.password,
  });

  if (error) {
    return INVALID_CREDENTIALS;
  }

  redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction(): Promise<void> {
  await auth.signOut();
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
    return { error: "Your current password is incorrect." };
  }

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
    select: { isDeleted: true },
  });

  // Only a portal User who isn't Deleted gets a link. The reply is identical either way.
  if (user && !user.isDeleted) {
    const redirectTo = new URL("/reset-password", process.env.NEXT_PUBLIC_APP_URL);
    for (const [key, value] of Object.entries(resetLinkParams(email))) {
      redirectTo.searchParams.set(key, value);
    }

    await auth.requestPasswordReset({ email, redirectTo: redirectTo.toString() });
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
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { error } = await auth.resetPassword({
    newPassword: parsed.data.password,
    token: parsed.data.token,
  });

  if (error) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  // Completing a reset leaves the User Active, not Awaiting first login.
  const email = verifyResetLinkEmail(
    formData.get("e")?.toString(),
    formData.get("s")?.toString(),
  );

  if (email) {
    await prisma.user.updateMany({
      where: { email },
      data: { mustChangePassword: false },
    });
  }

  redirect("/login?reset=1");
}
