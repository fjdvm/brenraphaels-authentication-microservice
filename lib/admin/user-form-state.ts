import type { FieldErrors } from "@/lib/validations/user";

export type CreateUserFormState = {
  error: string | null;
  fieldErrors: FieldErrors;
};

export const initialCreateUserFormState: CreateUserFormState = { error: null, fieldErrors: {} };
