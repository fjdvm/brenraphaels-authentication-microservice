"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { changedFields, fieldError, normalizeField, PAYMENT_FIELD_LABELS, type PaymentField, type PaymentSettings } from "@/lib/settings/payment-settings";

const GROUPS: { title: string; fields: PaymentField[] }[] = [
  { title: "GCash", fields: ["gcashNumber", "gcashName"] },
  { title: "Maya", fields: ["mayaNumber", "mayaName"] },
  { title: "Bank transfer", fields: ["bankName", "bankAccountName", "bankAccountNumber"] },
];

/**
 * The shop's GCash number, Maya number and bank account, shown to Customers at checkout. Customers send money
 * here, so a change is never optimistic: confirm first, then wait for the server. Admin edits; others view.
 */
export function PaymentSettingsForm({ canEdit, initial }: { canEdit: boolean; initial: PaymentSettings | null }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState<PaymentSettings | null>(initial);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!saved || !values) {
    return <p className="text-sm text-danger-text" role="alert">The payment details could not be read. Reload to try again.</p>;
  }
  const clean = Object.fromEntries(Object.entries(values).map(([field, value]) => [field, normalizeField(field as PaymentField, value)])) as PaymentSettings;
  const errors = Object.fromEntries(Object.keys(values).map((field) => [field, fieldError(field as PaymentField, clean[field as PaymentField])])) as Record<PaymentField, string | null>;
  const invalid = Object.values(errors).some(Boolean);
  const changed = changedFields(saved, clean);

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/payment", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean) });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.ok) {
        setSaved(body.settings);
        setValues(body.settings);
        setMessage({ kind: "ok", text: "Payment details saved. Customers see them at checkout." });
      } else {
        setMessage({ kind: "error", text: body.error ?? "The payment details could not be saved. Nothing was changed." });
      }
    } catch {
      setMessage({ kind: "error", text: "The server could not be reached. Nothing was changed." });
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <section aria-labelledby="payment-settings-heading" className="flex max-w-2xl flex-col gap-4 rounded-xl border border-panel-border bg-surface px-5 py-4.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold text-foreground" id="payment-settings-heading">Payment details</h2>
        <p className="text-xs text-on-surface-variant">
          Where Customers send money for GCash, Maya and bank transfer. A blank method shows &ldquo;ask us&rdquo; at checkout. Cash on Delivery needs none.
        </p>
      </div>
      {GROUPS.map((group) => (
        <fieldset className="flex flex-col gap-2" disabled={!canEdit} key={group.title}>
          <legend className="mb-1 text-[13px] font-semibold text-foreground">{group.title}</legend>
          {group.fields.map((field) => (
            <div className="flex flex-col gap-1" key={field}>
              <label className="text-[13px] font-medium text-field-label" htmlFor={`payment-${field}`}>{PAYMENT_FIELD_LABELS[field]}</label>
              <Input
                aria-invalid={errors[field] ? true : undefined}
                className="h-auto max-w-80 rounded-lg px-3 py-2.5 text-sm shadow-none md:text-sm"
                id={`payment-${field}`}
                onChange={(event) => { setValues({ ...values, [field]: event.target.value }); setMessage(null); }}
                value={values[field]}
              />
              {errors[field] ? <p className="text-xs text-danger-text" role="alert">{errors[field]}</p> : null}
            </div>
          ))}
        </fieldset>
      ))}
      <p className="text-xs text-on-surface-variant">{canEdit ? "Only an Admin can change these. Every change is logged." : "You can view these. Only an Admin can change them."}</p>
      {message ? <p className={message.kind === "ok" ? "text-sm text-identity" : "text-sm text-danger-text"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p> : null}
      {canEdit ? (
        <div>
          <Button disabled={changed.length === 0 || invalid || pending} onClick={() => setOpen(true)} size="cta" type="button" variant="identity">Save payment details</Button>
        </div>
      ) : null}
      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <DialogContent className="max-w-115">
          <DialogHeader
            description={`Customers will be told to send money to the new details: ${changed.map((field) => PAYMENT_FIELD_LABELS[field]).join(", ")}. The change is logged under your name.`}
            icon={<TriangleAlert aria-hidden="true" />}
            title="Change the payment details?"
          />
          <DialogBody />
          <DialogFooter>
            <DialogClose asChild><Button disabled={pending} size="cta" type="button" variant="row-action">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={save} size="cta" type="button" variant="identity">
              {pending ? "Saving…" : "Change details"}{pending ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
