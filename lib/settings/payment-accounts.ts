/** Payment accounts: where customers send money. An Admin adds, edits and deactivates them; nothing is ever deleted. */
import { canWrite } from "@/lib/auth/role-authority";

export const PAYMENT_METHODS = ["GCASH", "MAYA", "BANK"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABELS: Record<PaymentMethod, string> = { GCASH: "GCash", MAYA: "Maya", BANK: "Bank transfer" };

export type PaymentAccount = {
  id: string;
  method: PaymentMethod;
  accountName: string;
  accountNumber: string;
  /** Only for a bank account; empty for GCash and Maya. */
  bankName: string;
  active: boolean;
};

export type AccountInput = Pick<PaymentAccount, "method" | "accountName" | "accountNumber" | "bankName">;

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function normalizeMobile(value: string): string {
  const digits = value.replace(/[\s-]/g, "");
  if (digits.startsWith("+63")) return `0${digits.slice(3)}`;
  return digits.startsWith("63") && digits.length === 12 ? `0${digits.slice(2)}` : digits;
}

const TEXT = /^[\p{L}\p{M}0-9 .,'’&()\/-]+$/u;

function checkText(label: string, value: string): string | null {
  if (!value) return `${label} is required.`;
  if (value.length > 80) return `${label} must be 80 characters or fewer.`;
  return TEXT.test(value) ? null : `${label} has characters that do not belong in a name.`;
}

/** Cleans and validates an Admin's input, returning the first error in plain words. */
export function parseAccountInput(input: unknown): { ok: true; input: AccountInput } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Send the account as an object." };
  const raw = input as Record<string, unknown>;
  const method = PAYMENT_METHODS.find((candidate) => candidate === raw.method);
  if (!method) return { ok: false, error: "Choose a method: GCash, Maya or Bank transfer." };
  for (const field of ["accountName", "accountNumber"] as const) {
    if (typeof raw[field] !== "string") return { ok: false, error: `Account ${field === "accountName" ? "name" : "number"} must be text.` };
  }
  const accountName = clean(raw.accountName as string);
  const nameError = checkText("Account name", accountName);
  if (nameError) return { ok: false, error: nameError };

  let accountNumber: string;
  let bankName = "";
  if (method === "BANK") {
    if (raw.bankName !== undefined && typeof raw.bankName !== "string") return { ok: false, error: "Bank must be text." };
    bankName = clean((raw.bankName as string | undefined) ?? "");
    const bankError = checkText("Bank", bankName);
    if (bankError) return { ok: false, error: bankError };
    accountNumber = clean(raw.accountNumber as string).replace(/[\s-]/g, "");
    if (!/^\d{6,20}$/.test(accountNumber)) return { ok: false, error: "Account number must be 6 to 20 digits." };
  } else {
    accountNumber = normalizeMobile(clean(raw.accountNumber as string));
    if (!/^09\d{9}$/.test(accountNumber)) return { ok: false, error: `${METHOD_LABELS[method]} number must be an 11-digit mobile number such as 09171234567.` };
  }
  return { ok: true, input: { method, accountName, accountNumber, bankName } };
}

export type PaymentAccountPorts = {
  find(id: string): Promise<PaymentAccount | null>;
  create(input: AccountInput, actorId: string): Promise<PaymentAccount>;
  /** A method never changes after an account is created, so only these fields are written. */
  update(id: string, input: Omit<AccountInput, "method">, actorId: string): Promise<PaymentAccount>;
  setActive(id: string, active: boolean, actorId: string): Promise<PaymentAccount>;
  audit(event: { actorId: string; action: PaymentAccountAction; detail: string }): Promise<void>;
};
export type PaymentAccountAction = "payment_account.create" | "payment_account.update" | "payment_account.deactivate" | "payment_account.reactivate";

type Actor = { id: string; roleName: string };
type Result = { ok: true; account: PaymentAccount } | { ok: false; status: number; error: string };

const refused = (): Result => ({ ok: false, status: 403, error: "Only an Admin can change Payment accounts." });
const masked = (account: Pick<PaymentAccount, "accountNumber">) => `…${account.accountNumber.slice(-4)}`;
const describe = (account: AccountInput) =>
  `${METHOD_LABELS[account.method]}${account.method === "BANK" ? ` ${account.bankName}` : ""} · ${account.accountName} · ${masked(account)}`;

export async function addPaymentAccount(ports: PaymentAccountPorts, actor: Actor, input: unknown): Promise<Result> {
  if (!canWrite(actor.roleName)) return refused();
  const parsed = parseAccountInput(input);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const account = await ports.create(parsed.input, actor.id);
  await ports.audit({ actorId: actor.id, action: "payment_account.create", detail: `Added ${describe(parsed.input)}` });
  return { ok: true, account };
}

export async function editPaymentAccount(ports: PaymentAccountPorts, actor: Actor, id: string, input: unknown): Promise<Result> {
  if (!canWrite(actor.roleName)) return refused();
  const before = await ports.find(id);
  if (!before) return { ok: false, status: 404, error: "That Payment account does not exist." };
  const parsed = parseAccountInput(input);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (parsed.input.method !== before.method) return { ok: false, status: 400, error: "An account's method cannot change. Add a new account instead." };
  const { method: _method, ...fields } = parsed.input;
  const changes = [
    before.accountName !== fields.accountName && `name: ${before.accountName} → ${fields.accountName}`,
    before.accountNumber !== fields.accountNumber && `number: ${masked(before)} → ${masked(fields)}`,
    before.bankName !== fields.bankName && `bank: ${before.bankName || "blank"} → ${fields.bankName || "blank"}`,
  ].filter(Boolean);
  if (changes.length === 0) return { ok: true, account: before };
  const account = await ports.update(id, fields, actor.id);
  await ports.audit({ actorId: actor.id, action: "payment_account.update", detail: `Edited ${METHOD_LABELS[before.method]} ${masked(before)}: ${changes.join("; ")}` });
  return { ok: true, account };
}

export async function setPaymentAccountActive(ports: PaymentAccountPorts, actor: Actor, id: string, active: boolean): Promise<Result> {
  if (!canWrite(actor.roleName)) return refused();
  const before = await ports.find(id);
  if (!before) return { ok: false, status: 404, error: "That Payment account does not exist." };
  if (before.active === active) return { ok: true, account: before };
  const account = await ports.setActive(id, active, actor.id);
  await ports.audit({ actorId: actor.id, action: active ? "payment_account.reactivate" : "payment_account.deactivate", detail: `${active ? "Reactivated" : "Deactivated"} ${describe(before)}` });
  return { ok: true, account };
}

/**
 * The single-account shape the store read before Payment accounts: the first active account of each method.
 * Kept until the store reads `accounts`, so checkout does not go blank in between.
 */
export function firstActiveByMethod(accounts: PaymentAccount[]) {
  const first = (method: PaymentMethod) => accounts.find((account) => account.active && account.method === method);
  const gcash = first("GCASH"), maya = first("MAYA"), bank = first("BANK");
  return {
    gcashNumber: gcash?.accountNumber ?? "", gcashName: gcash?.accountName ?? "",
    mayaNumber: maya?.accountNumber ?? "", mayaName: maya?.accountName ?? "",
    bankName: bank?.bankName ?? "", bankAccountName: bank?.accountName ?? "", bankAccountNumber: bank?.accountNumber ?? "",
  };
}
