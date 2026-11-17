"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { centavosToPesos, pesosToCentavos, toWhole, type AutomaticChecks } from "@/lib/settings/automatic-checks";

/** Numbers are kept as typed so a half-typed value does not jump; they are checked on Save. */
type Draft = { checks: AutomaticChecks; amount: string; text: Record<string, string> };

const LIMITS = { count: 1000, days: 3650, waitHours: 8760 } as const;

const card = "flex flex-col gap-2 rounded-xl border border-panel-border bg-surface p-5";
const heading = "text-[15px] font-semibold text-foreground";

function draftOf(checks: AutomaticChecks): Draft {
  return {
    checks,
    amount: centavosToPesos(checks.cod.firstOrderOverAmount.amountInCentavos),
    text: {
      "returns.count": String(checks.returns.frequentReturns.count), "returns.days": String(checks.returns.frequentReturns.days),
      "unverified.count": String(checks.dashboard.unverifiedPayments.count), "unverified.waitHours": String(checks.dashboard.unverifiedPayments.waitHours),
      "spike.count": String(checks.dashboard.returnSpike.count), "spike.days": String(checks.dashboard.returnSpike.days),
      "failed.count": String(checks.dashboard.unresolvedFailedDeliveries.count),
    },
  };
}

/** The set to save, or null while any number is not valid. */
function build(draft: Draft): AutomaticChecks | null {
  const n = (key: string, max: number) => toWhole(draft.text[key], max);
  const amountInCentavos = pesosToCentavos(draft.amount);
  const rc = n("returns.count", LIMITS.count), rd = n("returns.days", LIMITS.days);
  const uc = n("unverified.count", LIMITS.count), uw = n("unverified.waitHours", LIMITS.waitHours);
  const sc = n("spike.count", LIMITS.count), sd = n("spike.days", LIMITS.days);
  const fc = n("failed.count", LIMITS.count);
  if ([amountInCentavos, rc, rd, uc, uw, sc, sd, fc].some((value) => value === null)) return null;
  const { cod, returns, dashboard } = draft.checks;
  return {
    ...draft.checks,
    cod: { ...cod, firstOrderOverAmount: { ...cod.firstOrderOverAmount, amountInCentavos: amountInCentavos! } },
    returns: { ...returns, frequentReturns: { ...returns.frequentReturns, count: rc!, days: rd! } },
    dashboard: {
      unverifiedPayments: { ...dashboard.unverifiedPayments, count: uc!, waitHours: uw! },
      returnSpike: { ...dashboard.returnSpike, count: sc!, days: sd! },
      unresolvedFailedDeliveries: { ...dashboard.unresolvedFailedDeliveries, count: fc! },
    },
  };
}

/**
 * Figma "Portal · Settings · Automatic checks": plain rules that only ever flag. An Admin switches each rule and edits its
 * numbers; a CEO sees the same without controls. The Senior/PWD duplicate-ID check is always on and locked. Settings are never
 * optimistic: the new values show only after CREOMS accepts them.
 */
export function AutomaticChecksView({ canEdit, initial, overdueUrl = null, saveSlot = null, active = true }: {
  canEdit: boolean;
  initial: AutomaticChecks | null;
  overdueUrl?: string | null;
  saveSlot?: HTMLElement | null;
  active?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(initial ? draftOf(initial) : null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!draft || !saved) {
    return <p className="text-sm text-danger-text" role="alert">The Automatic checks could not be read from CREOMS. Reload to try again.</p>;
  }

  const next = build(draft);
  const changed = next !== null && JSON.stringify(next) !== JSON.stringify(saved);
  const checks = draft.checks;
  const edit = (change: (current: AutomaticChecks) => AutomaticChecks) => { setDraft({ ...draft, checks: change(checks) }); setMessage(null); };
  const setText = (key: string, value: string) => { setDraft({ ...draft, text: { ...draft.text, [key]: value } }); setMessage(null); };

  async function save() {
    if (!next) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/creoms/automatic-checks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.ok) {
        setSaved(next);
        setDraft(draftOf(next));
        setMessage({ kind: "ok", text: "Automatic checks saved. The change is logged under your name." });
      } else {
        setMessage({ kind: "error", text: body.error ?? body.reason ?? "The Automatic checks could not be changed. Nothing was saved." });
      }
    } catch {
      setMessage({ kind: "error", text: "CREOMS could not be reached. Nothing was saved." });
    } finally {
      setPending(false);
    }
  }

  /** A number: an input for an Admin, plain text for a CEO. */
  const number = (key: string, label: string, width = "w-14") =>
    canEdit ? (
      <Input aria-label={label} className={`inline-block h-auto ${width} rounded-md px-2 py-0.5 text-center text-sm shadow-none md:text-sm`} inputMode="numeric" onChange={(event) => setText(key, event.target.value)} value={draft.text[key]} />
    ) : (
      <strong className="font-medium">{draft.text[key]}</strong>
    );

  const rule = (enabled: boolean, onChange: (on: boolean) => void, label: ReactNode, name: string) => (
    <div className="flex items-start gap-2.5 text-sm text-foreground" key={name}>
      {canEdit ? (
        <Checkbox aria-label={name} checked={enabled} onChange={(event) => onChange(event.target.checked)} />
      ) : (
        <span aria-hidden="true" className={enabled ? "flex size-4.5 shrink-0 items-center justify-center rounded-sm bg-checkbox" : "size-4.5 shrink-0 rounded-sm border-[1.5px] border-checkbox-border bg-surface"}>
          {enabled ? <FigmaIcon name="check-12" /> : null}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {label}
        {!canEdit ? <span className="sr-only"> — {enabled ? "On" : "Off"}</span> : null}
      </span>
    </div>
  );

  const proof = checks.paymentProof;
  const setProof = (key: keyof typeof proof) => (on: boolean) => edit((c) => ({ ...c, paymentProof: { ...c.paymentProof, [key]: { enabled: on } } }));
  const cod = checks.cod;
  const returns = checks.returns;
  const dash = checks.dashboard;

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="checks-proof" className={card}>
          <h2 className={heading} id="checks-proof">GCash payment proof</h2>
          {rule(proof.reference.enabled, setProof("reference"), "Flag a reference number already used on another order", "Reference already used")}
          {rule(proof.amount.enabled, setProof("amount"), "Flag when the amount doesn't match the order total", "Amount mismatch")}
          {rule(proof.date.enabled, setProof("date"), "Flag when the date is before the order was placed", "Date before the order")}
          {rule(proof.recipient.enabled, setProof("recipient"), "Flag when the recipient isn't the shop's GCash number", "Recipient mismatch")}
        </section>
        <section aria-labelledby="checks-cod" className={card}>
          <h2 className={heading} id="checks-cod">Cash on delivery flags (shown to staff when confirming)</h2>
          {rule(cod.firstOrder.enabled, (on) => edit((c) => ({ ...c, cod: { ...c.cod, firstOrder: { enabled: on } } })), "First order", "First order")}
          {rule(cod.firstOrderOverAmount.enabled, (on) => edit((c) => ({ ...c, cod: { ...c.cod, firstOrderOverAmount: { ...c.cod.firstOrderOverAmount, enabled: on } } })),
            <span className="flex flex-wrap items-center gap-1.5">First order over ₱
              {canEdit ? <Input aria-label="First order amount in pesos" className="inline-block h-auto w-24 rounded-md px-2 py-0.5 text-sm shadow-none md:text-sm" inputMode="numeric" onChange={(event) => { setDraft({ ...draft, amount: event.target.value }); setMessage(null); }} value={draft.amount} /> : <strong className="font-medium">{Number(draft.amount).toLocaleString("en-PH")}</strong>}
            </span>, "First order over an amount")}
          {rule(cod.earlierRefusal.enabled, (on) => edit((c) => ({ ...c, cod: { ...c.cod, earlierRefusal: { enabled: on } } })), "Past refused deliveries", "Past refused deliveries")}
        </section>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="checks-senior" className={card}>
          <h2 className={heading} id="checks-senior">Senior/PWD IDs</h2>
          <div className="flex items-start gap-2.5 text-sm text-foreground">
            <span aria-hidden="true" className="flex size-4.5 shrink-0 items-center justify-center rounded-sm bg-checkbox opacity-60"><FigmaIcon name="check-12" /></span>
            <span className="min-w-0 flex-1">Block the same ID number on a second account (hash)</span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-on-surface-variant"><FigmaIcon name="lock-12" />Always on. This check cannot be switched off.</p>
        </section>
        <section aria-labelledby="checks-returns" className={card}>
          <h2 className={heading} id="checks-returns">Returns</h2>
          {rule(returns.frequentReturns.enabled, (on) => edit((c) => ({ ...c, returns: { ...c.returns, frequentReturns: { ...c.returns.frequentReturns, enabled: on } } })),
            <span className="flex flex-wrap items-center gap-1.5">Flag a customer with {number("returns.count", "Returns to flag")}+ returns in {number("returns.days", "Days for returns")} days</span>, "Frequent returns")}
          {rule(returns.reusedPhoto.enabled, (on) => edit((c) => ({ ...c, returns: { ...c.returns, reusedPhoto: { enabled: on } } })), "Flag a photo already used on another return (photo hash)", "Photo already used")}
        </section>
        <section aria-labelledby="checks-alerts" className={card}>
          <h2 className={heading} id="checks-alerts">Dashboard alerts</h2>
          <div className="flex flex-col gap-3">
            {rule(dash.unverifiedPayments.enabled, (on) => edit((c) => ({ ...c, dashboard: { ...c.dashboard, unverifiedPayments: { ...c.dashboard.unverifiedPayments, enabled: on } } })),
              <span className="flex flex-col gap-0.5"><span className="text-xs font-medium text-on-surface-variant">Unverified payments</span>
                <span className="flex flex-wrap items-center gap-1.5 font-medium">{number("unverified.count", "Unverified payments to alert")}+ or waiting over {number("unverified.waitHours", "Hours a proof may wait")} h</span></span>, "Unverified payments")}
            {rule(dash.returnSpike.enabled, (on) => edit((c) => ({ ...c, dashboard: { ...c.dashboard, returnSpike: { ...c.dashboard.returnSpike, enabled: on } } })),
              <span className="flex flex-col gap-0.5"><span className="text-xs font-medium text-on-surface-variant">Returns on one product</span>
                <span className="flex flex-wrap items-center gap-1.5 font-medium">{number("spike.count", "Returns on one product")}+ in {number("spike.days", "Days for returns on one product")} days</span></span>, "Returns on one product")}
            {rule(dash.unresolvedFailedDeliveries.enabled, (on) => edit((c) => ({ ...c, dashboard: { ...c.dashboard, unresolvedFailedDeliveries: { ...c.dashboard.unresolvedFailedDeliveries, enabled: on } } })),
              <span className="flex flex-col gap-0.5"><span className="text-xs font-medium text-on-surface-variant">Unresolved failed deliveries</span>
                <span className="flex flex-wrap items-center gap-1.5 font-medium">{number("failed.count", "Unresolved failed deliveries")}+ unresolved</span></span>, "Unresolved failed deliveries")}
            <div className="flex flex-col gap-0.5 pl-7">
              <span className="text-xs font-medium text-on-surface-variant">Tickets breaching SLA</span>
              <span className="text-sm font-medium text-foreground">any{overdueUrl ? <> · <a className="text-identity underline" href={overdueUrl} rel="noopener" target="_blank">View overdue tickets</a></> : null}</span>
            </div>
          </div>
        </section>
        {message ? <p className={message.kind === "ok" ? "text-sm text-identity" : "text-sm text-danger-text"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p> : null}
        {canEdit && next === null ? <p className="text-xs text-danger-text" role="alert">Enter whole numbers: counts up to 1000, days up to 3650, hours up to 8760, pesos 0 or more.</p> : null}
      </div>
      {canEdit && active && saveSlot
        ? createPortal(<Button disabled={!changed || pending} onClick={save} size="cta" type="button" variant="identity">{pending ? "Saving…" : "Save changes"}{pending ? <Spinner /> : null}</Button>, saveSlot)
        : null}
    </>
  );
}
