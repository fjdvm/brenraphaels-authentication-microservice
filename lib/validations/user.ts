import { z } from "zod";

import { usernameInitial } from "@/lib/generate-username";

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .max(100, `Use 100 characters or fewer for the ${label}.`)
    .refine((value) => usernameInitial(value) !== null, {
      message: `The ${label} must start with a letter A-Z, because it forms the Username.`,
    });

export const createUserSchema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
  // Stored lowercase so the unique constraint enforces case-insensitive uniqueness.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  roleId: z.string().trim().min(1, "Choose a Role."),
  moduleIds: z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]),
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type ValidCreateUserInput = z.output<typeof createUserSchema>;

export type FieldErrors = Partial<Record<keyof CreateUserInput, string>>;

/** First message per field, for showing next to the matching input. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0] as keyof CreateUserInput | undefined;

    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
