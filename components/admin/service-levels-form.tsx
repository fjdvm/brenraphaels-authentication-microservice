"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type Targets = { firstReplyHours: number; resolveHours: number };

/** Whole hours from 1 to 8760, or null. */
export function toHours(text: string): number | null {
  if (!/^\d{1,4}$/.test(text.trim())) return null;
  const n = Number(text);
  return n >= 1 && n <= 8760 ? n : null;
}

/**
 * Service levels: the first reply and resolve targets, the same for every Priority. A change applies only to
 * Tickets opened afterwards. Settings are never optimistic: the form confirms first, then waits for CREOMS.
 */
export function ServiceLevelsForm({ canEdit, initial }: { canEdit: boolean; initial: Targets | null }) {
  const [saved, setSaved] = useState(initial);
  const [first, setFirst] = useState(initial ? String(initial.firstReplyHours) : "");
  const [resolve, setResolve] = useState(initial ? String(initial.resolveHours) : "");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const firstHours = toHours(first);
  const resolveHours = toHours(resolve);
  const valid = firstHours !== null && resolveHours !== null && resolveHours >= firstHours;
  const changed = valid && (firstHours !== saved?.firstReplyHours || resolveHours !== saved?.resolveHours);

  async function save() {
    if (!valid) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/creoms/service-levels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstReplyHours: firstHours, resolveHours }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.ok) {
        setSaved({ firstReplyHours: firstHours, resolveHours });
        setMessage({ kind: "ok", text: `Service levels are now ${firstHours} h to first reply and ${resolveHours} h to resolve. Tickets already open keep their old targets.` });
      } else {
        setMessage({ kind: "error", text: body.error ?? body.reason ?? "The Service levels could not be changed. Nothing was saved." });
      }
    } catch {
      setMessage({ kind: "error", text: "CREOMS could not be reached. Nothing was saved." });
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <section aria-labelledby="service-levels-heading" className="flex max-w-2xl flex-col gap-3.5 rounded-xl border border-panel-border bg-surface px-5 py-4.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold text-foreground" id="service-levels-heading">Service levels</h2>
        <p className="text-xs text-on-surface-variant">
          How long Staff have to first reply to a Ticket and to resolve it. The same for every Priority, and every hour counts. The clock stops while a Ticket is On hold or waiting on the Customer.
        </p>
      </div>
      {saved === null ? <p className="text-sm text-danger-text" role="alert">The current Service levels could not be read from CREOMS. Reload to try again.</p> : null}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-field-label" htmlFor="first-reply-hours">First reply target (hours)</label>
          <Input className="h-auto w-40 rounded-lg px-3 py-2.5 text-sm shadow-none md:text-sm" disabled={!canEdit || saved === null} id="first-reply-hours" inputMode="numeric" onChange={(event) => { setFirst(event.target.value); setMessage(null); }} value={first} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-field-label" htmlFor="resolve-hours">Resolve target (hours)</label>
          <Input className="h-auto w-40 rounded-lg px-3 py-2.5 text-sm shadow-none md:text-sm" disabled={!canEdit || saved === null} id="resolve-hours" inputMode="numeric" onChange={(event) => { setResolve(event.target.value); setMessage(null); }} value={resolve} />
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">
        {canEdit ? "Only an Admin can change these. Every change is logged. A change affects only Tickets opened afterwards." : "You can view these settings. Only an Admin can change them."}
      </p>
      {(first || resolve) && !valid ? <p className="text-xs text-danger-text" role="alert">Enter whole hours from 1 to 8760; the resolve target cannot be shorter than the first reply target.</p> : null}
      {message ? <p className={message.kind === "ok" ? "text-sm text-identity" : "text-sm text-danger-text"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p> : null}
      {canEdit ? (
        <div>
          <Button disabled={!changed || pending} onClick={() => setOpen(true)} size="cta" type="button" variant="identity">Save service levels</Button>
        </div>
      ) : null}

      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <DialogContent className="max-w-115">
          <DialogHeader
            description={`Tickets opened from now on get ${firstHours} h to first reply and ${resolveHours} h to resolve. Tickets already open keep theirs. The change is logged under your name.`}
            icon={<TriangleAlert aria-hidden="true" />}
            title="Change the Service levels?"
          />
          <DialogBody />
          <DialogFooter>
            <DialogClose asChild><Button disabled={pending} size="cta" type="button" variant="row-action">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={save} size="cta" type="button" variant="identity">
              {pending ? "Saving…" : "Change service levels"}{pending ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
