import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
});

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, "Use 128 characters or fewer.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: newPassword,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "The new passwords don't match.",
    path: ["confirmation"],
  })
  .refine((value) => value.password !== value.currentPassword, {
    message: "Choose a password different from your current one.",
    path: ["password"],
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPassword,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "The new passwords don't match.",
    path: ["confirmation"],
  });

/** First validation message, for showing a single error under a form. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}
