import type { FieldErrors } from "@/lib/validations/user";

export type EditUserAccessFormState = {
  error: string | null;
  saved: boolean;
  fieldErrors: FieldErrors;
};

export const initialEditUserAccessFormState: EditUserAccessFormState = {
  error: null,
  saved: false,
  fieldErrors: {},
};
