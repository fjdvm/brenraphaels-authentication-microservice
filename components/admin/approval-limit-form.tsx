"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const pesos = (centavos: number) => `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: centavos % 100 ? 2 : 0 })}`;

/** Parses "5,000" or "5000.50" to whole centavos; null when it is not a nonnegative amount. */
export function toCentavos(text: string): number | null {
  const cleaned = text.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/**
 * The Approval limit: refunds and write-offs of more than this need the CEO's final approval. Changing it moves
 * the owner's authority, so it is never optimistic: the form confirms first, then waits for CREOMS.
 */
export function ApprovalLimitForm({ canEdit, initialCentavos }: { canEdit: boolean; initialCentavos: number | null }) {
  const [saved, setSaved] = useState(initialCentavos);
  const [text, setText] = useState(initialCentavos === null ? "" : String(initialCentavos / 100));
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const amount = toCentavos(text);
  const changed = amount !== null && amount !== saved;

  async function save() {
    if (amount === null) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/creoms/approval-limit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountInCentavos: amount }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.ok) {
        setSaved(amount);
        setMessage({ kind: "ok", text: `Approval limit is now ${pesos(amount)}.` });
      } else {
        setMessage({ kind: "error", text: body.error ?? body.reason ?? "The Approval limit could not be changed. Nothing was saved." });
      }
    } catch {
      setMessage({ kind: "error", text: "CREOMS could not be reached. Nothing was saved." });
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <section aria-labelledby="approval-limit-heading" className="flex max-w-2xl flex-col gap-3.5 rounded-xl border border-panel-border bg-surface px-5 py-4.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold text-foreground" id="approval-limit-heading">Approval limit</h2>
        <p className="text-xs text-on-surface-variant">
          A refund or write-off of more than this amount also needs the CEO&apos;s final approval. An amount equal to the limit stops at the Manager.
        </p>
      </div>
      {saved === null ? <p className="text-sm text-danger-text" role="alert">The current limit could not be read from CREOMS. Reload to try again.</p> : null}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-field-label" htmlFor="approval-limit">Limit in pesos</label>
        <Input
          aria-describedby="approval-limit-hint"
          className="h-auto max-w-60 rounded-lg px-3 py-2.5 text-sm shadow-none md:text-sm"
          disabled={!canEdit || saved === null}
          id="approval-limit"
          inputMode="decimal"
          onChange={(event) => { setText(event.target.value); setMessage(null); }}
          value={text}
        />
        <p className="text-xs text-on-surface-variant" id="approval-limit-hint">
          {canEdit ? "Only an Admin can change this. Every change is logged." : "You can view this setting. Only an Admin can change it."}
        </p>
        {text && amount === null ? <p className="text-xs text-danger-text" role="alert">Enter an amount in pesos, such as 5000 or 5,000.50.</p> : null}
      </div>
      {message ? <p className={message.kind === "ok" ? "text-sm text-identity" : "text-sm text-danger-text"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p> : null}
      {canEdit ? (
        <div>
          <Button disabled={!changed || pending} onClick={() => setOpen(true)} size="cta" type="button" variant="identity">Save limit</Button>
        </div>
      ) : null}

      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <DialogContent className="max-w-115">
          <DialogHeader
            description={`Refunds and write-offs of more than ${amount === null ? "" : pesos(amount)} will need the CEO's final approval. The change is logged under your name.`}
            icon={<TriangleAlert aria-hidden="true" />}
            title="Change the Approval limit?"
          />
          <DialogBody />
          <DialogFooter>
            <DialogClose asChild><Button disabled={pending} size="cta" type="button" variant="row-action">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={save} size="cta" type="button" variant="identity">
              {pending ? "Saving…" : "Change limit"}{pending ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
