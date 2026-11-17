/** The shop's payment details. An Admin sets them in General settings; the storefront shows them at checkout. */
import { canWrite } from "@/lib/auth/role-authority";
export const PAYMENT_FIELDS = [
  "gcashNumber", "gcashName", "mayaNumber", "mayaName", "bankName", "bankAccountName", "bankAccountNumber",
] as const;
export type PaymentField = (typeof PAYMENT_FIELDS)[number];
export type PaymentSettings = Record<PaymentField, string>;

export const EMPTY_PAYMENT_SETTINGS: PaymentSettings = Object.fromEntries(PAYMENT_FIELDS.map((field) => [field, ""])) as PaymentSettings;

export const PAYMENT_FIELD_LABELS: Record<PaymentField, string> = {
  gcashNumber: "GCash number", gcashName: "GCash account name", mayaNumber: "Maya number", mayaName: "Maya account name",
  bankName: "Bank", bankAccountName: "Bank account name", bankAccountNumber: "Bank account number",
};

const NUMBER_FIELDS: PaymentField[] = ["gcashNumber", "mayaNumber"];

/** Trims; a mobile number is stored as 11 digits starting 09; a bank account number as digits only. */
export function normalizeField(field: PaymentField, value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (NUMBER_FIELDS.includes(field)) {
    const digits = text.replace(/[\s-]/g, "");
    return digits.startsWith("+63") ? `0${digits.slice(3)}` : digits.startsWith("63") && digits.length === 12 ? `0${digits.slice(2)}` : digits;
  }
  return field === "bankAccountNumber" ? text.replace(/[\s-]/g, "") : text;
}

/** An error message for one field, or null when it is blank (the method then shows "ask us") or valid. */
export function fieldError(field: PaymentField, value: string): string | null {
  if (!value) return null;
  if (NUMBER_FIELDS.includes(field)) return /^09\d{9}$/.test(value) ? null : `${PAYMENT_FIELD_LABELS[field]} must be an 11-digit mobile number such as 09171234567.`;
  if (field === "bankAccountNumber") return /^\d{6,20}$/.test(value) ? null : "Bank account number must be 6 to 20 digits.";
  if (value.length > 80) return `${PAYMENT_FIELD_LABELS[field]} must be 80 characters or fewer.`;
  return /^[\p{L}\p{M}0-9 .,'&()\/-]+$/u.test(value) ? null : `${PAYMENT_FIELD_LABELS[field]} has characters that do not belong in a name.`;
}

/** Normalizes every field of an input; returns the clean settings or the first error. */
export function parsePaymentSettings(input: unknown): { ok: true; settings: PaymentSettings } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Send the payment details as an object." };
  const settings = { ...EMPTY_PAYMENT_SETTINGS };
  for (const field of PAYMENT_FIELDS) {
    const raw = (input as Record<string, unknown>)[field];
    if (typeof raw !== "string") return { ok: false, error: `${PAYMENT_FIELD_LABELS[field]} must be text.` };
    settings[field] = normalizeField(field, raw);
    const error = fieldError(field, settings[field]);
    if (error) return { ok: false, error };
  }
  return { ok: true, settings };
}

/** Fields that differ, in the order of PAYMENT_FIELDS. */
export function changedFields(before: PaymentSettings, after: PaymentSettings): PaymentField[] {
  return PAYMENT_FIELDS.filter((field) => before[field] !== after[field]);
}

const mask = (field: PaymentField, value: string) =>
  !value ? "blank" : NUMBER_FIELDS.includes(field) || field === "bankAccountNumber" ? `…${value.slice(-4)}` : value;

/** The audit detail: which fields changed, with numbers masked to their last four digits. */
export function describeChange(before: PaymentSettings, after: PaymentSettings): string {
  return changedFields(before, after).map((field) => `${PAYMENT_FIELD_LABELS[field]}: ${mask(field, before[field])} → ${mask(field, after[field])}`).join("; ");
}

export type PaymentSettingsPorts = {
  read(): Promise<PaymentSettings>;
  write(settings: PaymentSettings, actorId: string): Promise<void>;
  audit(event: { actorId: string; detail: string }): Promise<void>;
};

/** Saves for an Admin, and logs `payment_settings.changed` only when something changed. */
export async function savePaymentSettings(
  ports: PaymentSettingsPorts, actor: { id: string; roleName: string }, input: unknown,
): Promise<{ ok: true; settings: PaymentSettings; changed: PaymentField[] } | { ok: false; status: number; error: string }> {
  if (!canWrite(actor.roleName)) return { ok: false, status: 403, error: "Only an Admin can change the payment details." };
  const parsed = parsePaymentSettings(input);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const before = await ports.read();
  const changed = changedFields(before, parsed.settings);
  if (changed.length === 0) return { ok: true, settings: before, changed };
  await ports.write(parsed.settings, actor.id);
  await ports.audit({ actorId: actor.id, detail: describeChange(before, parsed.settings) });
  return { ok: true, settings: parsed.settings, changed };
}
