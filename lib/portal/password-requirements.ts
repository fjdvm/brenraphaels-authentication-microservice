import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

/** Figma's four requirement chips under the new password: shown met (green) or not (grey) as the User types. */
export const PASSWORD_REQUIREMENTS = [
  { label: `${MIN_PASSWORD_LENGTH}+ characters`, isMet: (password: string) => password.length >= MIN_PASSWORD_LENGTH },
  { label: "Uppercase letter", isMet: (password: string) => /[A-Z]/.test(password) },
  { label: "Number", isMet: (password: string) => /\d/.test(password) },
  { label: "Special character", isMet: (password: string) => /[^A-Za-z0-9]/.test(password) },
] as const;
