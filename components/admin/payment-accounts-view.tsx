"use client";

import { TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { METHOD_LABELS, PAYMENT_METHODS, parseAccountInput, type AccountInput, type PaymentAccount, type PaymentMethod } from "@/lib/settings/payment-accounts";

type Fields = Pick<AccountInput, "accountName" | "accountNumber" | "bankName">;
type Draft = Fields & { key: number; method: PaymentMethod };

const COPY: Record<PaymentMethod, string> = {
  GCASH: "Customers send GCash payments here, then submit the reference number.",
  MAYA: "Deactivate every Maya account to hide the method; checkout then shows “ask us”.",
  BANK: "Customers can also use InstaPay from any bank.",
};
const NUMBER_LABEL: Record<PaymentMethod, string> = { GCASH: "GCash number", MAYA: "Maya number", BANK: "Bank account number" };
const NAME_LABEL: Record<PaymentMethod, string> = { GCASH: "GCash account name", MAYA: "Maya account name", BANK: "Bank account name" };
const inputClass = "h-auto rounded-lg px-3 py-2.25 text-sm shadow-none md:text-sm";

/**
 * Figma "Portal · Settings · Payment details": a card per method listing its Payment accounts, "What customers see",
 * and the one Save changes in the page header. Accounts are never deleted, only deactivated. Customers send money to
 * these, so nothing is optimistic: Save and Deactivate confirm first, then wait for the server. A CEO sees values only.
 */
export function PaymentAccountsView({ canEdit, initial, saveSlot = null, active = true }: { canEdit: boolean; initial: PaymentAccount[] | null; saveSlot?: HTMLElement | null; active?: boolean }) {
  const [accounts, setAccounts] = useState(initial ?? []);
  const [edits, setEdits] = useState<Record<string, Fields>>({});
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [confirm, setConfirm] = useState<{ kind: "save" } | { kind: "toggle"; account: PaymentAccount } | null>(null);
  const nextKey = useRef(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const valueOf = (account: PaymentAccount): Fields => edits[account.id] ?? account;
  const dirty = accounts.filter((account) => {
    const edit = edits[account.id];
    return edit && (edit.accountName !== account.accountName || edit.accountNumber !== account.accountNumber || edit.bankName !== account.bankName);
  });
  const checked = [
    ...dirty.map((account) => ({ id: account.id, parsed: parseAccountInput({ method: account.method, ...edits[account.id] }) })),
    ...drafts.map((draft) => ({ id: draft.key, parsed: parseAccountInput(draft) })),
  ];
  const errorFor = (id: string | number) => { const entry = checked.find((candidate) => candidate.id === id); return entry && !entry.parsed.ok ? entry.parsed.error : null; };
  const changed = dirty.length + drafts.length > 0;
  const valid = changed && checked.every((entry) => entry.parsed.ok);

  async function send(url: string, method: "POST" | "PATCH", body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error ?? "The change could not be saved.");
    return result.account as PaymentAccount;
  }

  async function save() {
    setPending(true);
    setMessage(null);
    let done = 0;
    try {
      for (const account of dirty) {
        const parsed = parseAccountInput({ method: account.method, ...edits[account.id] });
        if (!parsed.ok) continue;
        const updated = await send(`/api/settings/payment-accounts/${account.id}`, "PATCH", parsed.input);
        setAccounts((current) => current.map((row) => (row.id === updated.id ? updated : row)));
        setEdits(({ [account.id]: _saved, ...rest }) => rest);
        done += 1;
      }
      for (const draft of drafts) {
        const parsed = parseAccountInput(draft);
        if (!parsed.ok) continue;
        const created = await send("/api/settings/payment-accounts", "POST", parsed.input);
        setAccounts((current) => [...current, created]);
        setDrafts((current) => current.filter((row) => row.key !== draft.key));
        done += 1;
      }
      setMessage({ kind: "ok", text: "Payment accounts saved. Customers see the active ones at checkout." });
    } catch (error) {
      setMessage({ kind: "error", text: `${done} of ${dirty.length + drafts.length} changes saved. ${error instanceof Error ? error.message : "The server could not be reached."} The rest were not changed.` });
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  async function toggle(account: PaymentAccount) {
    setPending(true);
    setMessage(null);
    try {
      const updated = await send(`/api/settings/payment-accounts/${account.id}`, "PATCH", { active: !account.active });
      setAccounts((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setMessage({ kind: "ok", text: `${METHOD_LABELS[account.method]} account ${updated.active ? "reactivated. Customers see it at checkout again" : "deactivated. Customers no longer see it, and past orders keep it"}.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "The server could not be reached. Nothing was changed." });
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  function field(id: string, label: string, value: string, set: (next: string) => void, readOnly: boolean, invalid: boolean) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {readOnly ? (
          <>
            <span className="text-[13px] font-medium text-foreground" id={`${id}-label`}>{label}</span>
            <p aria-labelledby={`${id}-label`} className="rounded-lg border border-input bg-surface px-3 py-2.25 text-sm text-foreground" role="group">{value || "—"}</p>
          </>
        ) : (
          <>
            <label className="text-[13px] font-medium text-foreground" htmlFor={id}>{label}</label>
            <Input aria-invalid={invalid || undefined} className={inputClass} id={id} onChange={(event) => { set(event.target.value); setMessage(null); }} value={value} />
          </>
        )}
      </div>
    );
  }

  function fieldsFor(method: PaymentMethod, idBase: string, value: Fields, set: (next: Fields) => void, readOnly: boolean, error: string | null) {
    const bad = Boolean(error);
    const name = field(`${idBase}-name`, NAME_LABEL[method], value.accountName, (next) => set({ ...value, accountName: next }), readOnly, bad);
    const number = field(`${idBase}-number`, NUMBER_LABEL[method], value.accountNumber, (next) => set({ ...value, accountNumber: next }), readOnly, bad);
    return (
      <>
        {method === "BANK" ? (
          <>
            <div className="flex gap-3">{field(`${idBase}-bank`, "Bank", value.bankName, (next) => set({ ...value, bankName: next }), readOnly, bad)}{name}</div>
            <div className="flex gap-3">{number}<div className="flex-1" /></div>
          </>
        ) : (
          <div className="flex gap-3">{number}{name}</div>
        )}
        {error ? <p className="text-xs text-danger-text" role="alert">{error}</p> : null}
      </>
    );
  }

  const activeByMethod = (method: PaymentMethod) => accounts.filter((account) => account.method === method && account.active);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4">
        {message ? <p className={message.kind === "ok" ? "text-sm text-identity" : "text-sm text-danger-text"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p> : null}
        {initial === null ? <p className="text-sm text-danger-text" role="alert">The Payment accounts could not be read. Reload to try again.</p> : null}
        {PAYMENT_METHODS.map((method) => {
          const rows = accounts.filter((account) => account.method === method);
          const newRows = drafts.filter((draft) => draft.method === method);
          return (
            <section aria-label={METHOD_LABELS[method]} className="flex flex-col gap-3 rounded-xl border border-panel-border bg-surface p-5 leading-[normal]" key={method}>
              <h2 className="text-[15px] font-semibold text-foreground">{METHOD_LABELS[method]}</h2>
              <p className="text-[13px] text-on-surface-variant">{COPY[method]}</p>
              {rows.map((account, index) => (
                <div aria-label={`${METHOD_LABELS[method]} account ${index + 1}`} className={cn("flex flex-col gap-3", index > 0 && "border-t border-table-divider pt-3")} key={account.id} role="group">
                  {fieldsFor(method, `account-${account.id}`, valueOf(account), (next) => setEdits((current) => ({ ...current, [account.id]: next })), !canEdit || !account.active, errorFor(account.id))}
                  <div className="flex items-center gap-2">
                    {account.active ? null : <span className="rounded-full bg-[#f1f1f3] px-2.5 py-[3px] text-xs font-medium text-[#52525b]">Inactive</span>}
                    {canEdit ? (
                      <Button className="ml-auto" disabled={pending} onClick={() => setConfirm({ kind: "toggle", account })} size="row" type="button" variant="row-action">
                        {account.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {newRows.map((draft) => (
                <div aria-label={`New ${METHOD_LABELS[method]} account`} className="flex flex-col gap-3 border-t border-table-divider pt-3" key={draft.key} role="group">
                  {fieldsFor(method, `draft-${draft.key}`, draft, (next) => setDrafts((current) => current.map((row) => (row.key === draft.key ? { ...row, ...next } : row))), false, draft.accountName || draft.accountNumber || draft.bankName ? errorFor(draft.key) : null)}
                  <Button className="self-end" onClick={() => setDrafts((current) => current.filter((row) => row.key !== draft.key))} size="row" type="button" variant="row-action">Remove</Button>
                </div>
              ))}
              {rows.length === 0 && newRows.length === 0 ? <p className="text-[13px] text-on-surface-variant">No {METHOD_LABELS[method]} account yet.</p> : null}
              {canEdit ? (
                <div>
                  <Button onClick={() => setDrafts((current) => [...current, { key: nextKey.current++, method, accountName: "", accountNumber: "", bankName: "" }])} size="row" type="button" variant="row-action">
                    Add {METHOD_LABELS[method]} account
                  </Button>
                </div>
              ) : null}
              {method === "BANK" ? (
                <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <FigmaIcon name="lock-12" />
                  Only an Admin can change these. Every change is logged.
                </p>
              ) : null}
            </section>
          );
        })}
        <section aria-label="Cash on Delivery" className="flex flex-col gap-3 rounded-xl border border-panel-border bg-surface p-5 leading-[normal]">
          <h2 className="text-[15px] font-semibold text-foreground">Cash on Delivery</h2>
          <p className="text-[13px] text-on-surface-variant">No account needed. COD orders skip the payment steps; cash is collected on delivery or at pickup.</p>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="what-customers-see" className="flex flex-col gap-3 rounded-xl border border-panel-border bg-surface p-5 leading-[normal]">
          <h2 className="text-[15px] font-semibold text-foreground" id="what-customers-see">What customers see</h2>
          <p className="text-[13px] text-on-surface-variant">Each manual method shows the account name and number with Copy buttons, and the exact amount to send.</p>
          <ul className="flex flex-col">
            {PAYMENT_METHODS.flatMap((method) => {
              const shown = activeByMethod(method);
              return shown.length === 0
                ? [{ key: method, title: METHOD_LABELS[method], detail: "No active account · checkout shows “ask us”", badge: "Hidden" }]
                : shown.map((account) => ({ key: account.id, title: METHOD_LABELS[method], detail: `${method === "BANK" ? `${account.bankName} ` : ""}${account.accountNumber} · ${account.accountName}`, badge: "Shown" }));
            }).concat([{ key: "cod", title: "Cash on Delivery", detail: "No details needed", badge: "Shown" }]).map((row) => (
              <li className="flex items-center gap-2.5 py-2" key={row.key}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[13px] font-medium text-foreground">{row.title}</p>
                  <p className="text-xs text-on-surface-variant">{row.detail}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-medium", row.badge === "Shown" ? "bg-[#e3f4e8] text-[#1e6b3a]" : "bg-[#f1f1f3] text-[#52525b]")}>{row.badge}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="flex items-start gap-2.5 rounded-[10px] bg-[#f1f1f3] p-3 text-xs text-[#52525b]">
          <FigmaIcon className="shrink-0" name="check-16" />
          Changes are saved to Activity logs with your name.
        </p>
      </div>

      {canEdit && active && saveSlot
        ? createPortal(<Button disabled={!valid || pending} onClick={() => setConfirm({ kind: "save" })} size="cta" type="button" variant="identity">Save changes</Button>, saveSlot)
        : null}

      <Dialog onOpenChange={(next) => !pending && !next && setConfirm(null)} open={confirm !== null}>
        <DialogContent className="max-w-115">
          <DialogHeader
            description={
              confirm?.kind === "toggle"
                ? confirm.account.active
                  ? `Customers will stop seeing this ${METHOD_LABELS[confirm.account.method]} account at checkout. Orders already placed keep it. The change is logged under your name.`
                  : `Customers will see this ${METHOD_LABELS[confirm?.account.method ?? "GCASH"]} account at checkout again. The change is logged under your name.`
                : `Customers will be told to send money to the new details: ${dirty.length} edited and ${drafts.length} new. The change is logged under your name.`
            }
            icon={<TriangleAlert aria-hidden="true" />}
            title={confirm?.kind === "toggle" ? (confirm.account.active ? "Deactivate this account?" : "Reactivate this account?") : "Change the Payment accounts?"}
          />
          <DialogBody />
          <DialogFooter>
            <DialogClose asChild><Button disabled={pending} size="cta" type="button" variant="row-action">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={() => (confirm?.kind === "toggle" ? toggle(confirm.account) : save())} size="cta" type="button" variant="identity">
              {pending ? "Saving…" : confirm?.kind === "toggle" ? (confirm.account.active ? "Deactivate" : "Reactivate") : "Save changes"}{pending ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
