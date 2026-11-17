"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FigmaIcon } from "@/components/ui/figma-icon";
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
export function ApprovalLimitForm({ canEdit, initialCentavos, saveSlot = null, active = true }: { canEdit: boolean; initialCentavos: number | null; saveSlot?: HTMLElement | null; active?: boolean }) {
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
    <section aria-labelledby="approval-limit-heading" className="flex flex-col gap-3 rounded-xl border border-panel-border bg-surface p-5 leading-[normal]">
      <h2 className="text-[15px] font-semibold text-foreground" id="approval-limit-heading">Approval limit</h2>
      <p className="text-[13px] text-on-surface-variant">
        A refund or write-off of more than this amount also needs the CEO&apos;s final approval. An amount equal to the limit stops at the Manager.
      </p>
      {saved === null ? <p className="text-sm text-danger-text" role="alert">The current limit could not be read from CREOMS. Reload to try again.</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          {canEdit ? (
            <>
              <label className="text-[13px] font-medium text-foreground" htmlFor="approval-limit">Limit in pesos</label>
              <Input
                className="h-auto rounded-lg px-3 py-2.25 text-sm shadow-none md:text-sm"
                disabled={saved === null}
                id="approval-limit"
                inputMode="decimal"
                onChange={(event) => { setText(event.target.value); setMessage(null); }}
                value={text}
              />
            </>
          ) : (
            <>
              <span className="text-[13px] font-medium text-foreground" id="approval-limit-label">Limit in pesos</span>
              <p aria-labelledby="approval-limit-label" className="rounded-lg border border-input bg-surface px-3 py-2.25 text-sm text-foreground" role="group">{saved === null ? "—" : pesos(saved)}</p>
            </>
          )}
        </div>
      </div>
      {text && amount === null && canEdit ? <p className="text-xs text-danger-text" role="alert">Enter an amount in pesos, such as 5000 or 5,000.50.</p> : null}
      <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <FigmaIcon name="lock-12" />
        Only an Admin can change this. Every change is logged. Requests keep the limit that applied when they were sent.
      </p>
      {message ? <p className={message.kind === "ok" ? "text-sm text-identity" : "text-sm text-danger-text"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p> : null}
      {canEdit && active && saveSlot
        ? createPortal(<Button disabled={!changed || pending} onClick={() => setOpen(true)} size="cta" type="button" variant="identity">Save changes</Button>, saveSlot)
        : null}

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
