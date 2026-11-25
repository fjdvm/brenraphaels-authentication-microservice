"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { seeAccountRequestAction, resendRequestLoginAction, declineAccountRequestAction } from "@/actions/account-requests";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  filterRequests,
  formatWait,
  groupAccess,
  summarizeRequests,
  tabCounts,
  type AccessSystem,
  type AccountRequestRow,
  type RequestTab,
} from "@/lib/admin/account-requests";
import { cn } from "@/lib/utils/cn";
import { uiLabel } from "@/lib/utils/ui-label";

type Props = {
  heading: ReactNode;
  /** null when the requests could not be read. */
  requests: AccountRequestRow[] | null;
  systems: AccessSystem[];
  /** The server's clock, so "Today" reads the same on server and client. */
  now: string;
  initialRequestId?: string;
  /** Full access (Admin). A CEO has View access: no write control, and opening a request does not mark it Seen. */
  canWrite: boolean;
};

const panel = "rounded-xl border border-panel-border bg-surface";
const PHT = "Asia/Manila";

const STATUS: Record<AccountRequestRow["status"], { label: string; variant: "warning" | "success" | "danger" | "muted" }> = {
  new: { label: "New", variant: "warning" },
  seen: { label: "Seen", variant: "warning" },
  created: { label: "Created", variant: "success" },
  declined: { label: "Declined", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const phtDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: PHT });
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function relativeDate(iso: string, now: Date) {
  const then = new Date(iso);
  if (phtDay(then) === phtDay(now)) return "Today";
  if (phtDay(then) === phtDay(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: PHT });
}

function systemsOf(request: AccountRequestRow, systems: AccessSystem[]) {
  const requested = new Set(request.moduleIds);
  return systems.filter((system) => system.modules.some((module) => requested.has(module.id))).map((system) => uiLabel(system.name));
}

/** Figma "Portal · Account requests" and "Portal · Account request detail". */
export function AccountRequestsView({ heading, requests, systems, now, initialRequestId, canWrite }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function openRequest(id: string) {
    setOpenId(id);
    if (!canWrite) return;
    try { await seeAccountRequestAction(id); router.refresh(); } catch { toast.error("Could not mark this request Seen. Close and reopen to retry."); }
  }
  async function resend(id: string) {
    setBusy(true);
    try { const result = await resendRequestLoginAction(id); if (result.error) toast.error(result.error); router.refresh(); } catch { toast.error("Login details could not be sent. Try again."); } finally { setBusy(false); }
  }
  async function decline(id: string, input: { reason: string; message?: string }) {
    try {
      const result = await declineAccountRequestAction(id, input);
      if (result.error) return result.error;
      setOpenId(null);
      router.refresh();
      return null;
    } catch { return "The request could not be declined. Try again."; }
  }
  const initialRequest = requests?.find(request => request.id === initialRequestId);
  const [tab, setTab] = useState<RequestTab>(initialRequest?.status === "created" ? "created" : "new");
  const [openId, setOpenId] = useState<string | null>(initialRequest?.id ?? null);
  const clock = new Date(now);

  const headingBlock = (
    <div className="flex min-w-0 flex-col gap-1 leading-[normal]">{heading}</div>
  );

  if (requests === null) {
    return (
      <>
        {headingBlock}
        <div className="flex flex-col items-start gap-3 rounded-lg bg-badge-danger px-4 py-3 text-sm text-badge-danger-foreground" role="alert">
          <p>Could not load Account requests. Reload the page to try again.</p>
          <Button onClick={() => window.location.reload()} size="sm" type="button" variant="outline">
            Retry
          </Button>
        </div>
      </>
    );
  }

  const summary = summarizeRequests(requests, clock);
  const counts = tabCounts(requests);
  const shown = filterRequests(requests, tab);
  const open = requests.find((request) => request.id === openId) ?? null;

  const stats = [
    { label: "New", value: String(summary.new), hint: "Waiting for you", hintClass: "text-badge-warning-foreground" },
    { label: "Created this month", value: String(summary.createdThisMonth), hint: "Accounts made from requests" },
    { label: "Declined", value: String(summary.declined), hint: "Requester was told why" },
    { label: "Average wait", value: formatWait(summary.averageWaitHours), hint: "From request to account" },
  ];
  const tabs: { value: RequestTab; label: string }[] = [
    { value: "new", label: "New" },
    { value: "created", label: "Created" },
    { value: "declined", label: "Declined" },
    { value: "all", label: "All" },
  ];

  return (
    <>
      {headingBlock}

      <ul aria-label="Account request summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <li className={cn(panel, "flex flex-col gap-1.5 px-5 py-4 leading-[normal]")} key={stat.label}>
            <p className="text-[13px] font-medium text-on-surface-variant">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
            <p className={cn("text-xs text-on-surface-variant", stat.hintClass)}>{stat.hint}</p>
          </li>
        ))}
      </ul>

      <div aria-label="Filter by status" className="flex gap-1" role="tablist">
        {tabs.map((entry) => (
          <button
            aria-selected={tab === entry.value}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium leading-[normal] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === entry.value ? "bg-identity-soft text-identity" : "text-on-surface-variant hover:text-foreground",
            )}
            key={entry.value}
            onClick={() => setTab(entry.value)}
            role="tab"
            type="button"
          >
            {entry.label}
            {entry.value === "all" ? "" : ` ${counts[entry.value]}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className={cn(panel, "px-5 py-12 text-center text-sm text-on-surface-variant")}>
          {requests.length === 0
            ? "No account requests yet. Requests sent from HRMS will show up here."
            : "No requests in this tab."}
        </div>
      ) : (
        <div className={cn(panel, "overflow-x-auto px-5 py-1")}>
          <table className="w-full min-w-190 table-fixed text-left leading-[normal]">
            <thead className="text-xs font-medium text-on-surface-variant">
              <tr className="border-b border-table-divider">
                <th className="w-[240px] py-3 font-medium" scope="col">Person</th>
                <th className="w-[140px] py-3 font-medium" scope="col">Role</th>
                <th className="w-[150px] py-3 font-medium" scope="col">Systems</th>
                <th className="w-[170px] py-3 font-medium" scope="col">Requested by</th>
                <th className="w-[110px] py-3 font-medium" scope="col">Date</th>
                <th className="py-3 font-medium" scope="col"><span className="sr-only">Status</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((request) => (
                <tr className="border-b border-table-divider" key={request.id}>
                  <td className="py-3.5 pr-3">
                    <button
                      className="flex flex-col rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => { void openRequest(request.id); }}
                      type="button"
                    >
                      <span className="text-sm font-semibold text-foreground">{request.personName}</span>
                      <span className="text-xs text-on-surface-variant">{request.workEmail}</span>
                    </button>
                  </td>
                  <td className="py-3.5 pr-3 text-sm text-nav-foreground">{uiLabel(request.roleName)}</td>
                  <td className="py-3.5 pr-3">
                    <span className="flex flex-wrap gap-1.5">
                      {systemsOf(request, systems).map((name) => (
                        <Badge key={name} variant="identity">{name}</Badge>
                      ))}
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 text-sm text-foreground">{request.requesterName}</td>
                  <td className="py-3.5 pr-3 text-sm text-nav-foreground">{relativeDate(request.createdAt, clock)}</td>
                  <td className="py-3.5">
                    <span className="flex items-center justify-end gap-2">
                      <Badge variant={STATUS[request.status].variant}>{STATUS[request.status].label}</Badge>
                      <FigmaIcon name="chevron-right" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-2.5 rounded-lg bg-identity-soft px-4 py-3 text-[13px] text-identity">
        <FigmaIcon className="shrink-0" name="shield-16" />
        Staff with &quot;Request accounts&quot; permission (for example HR and branch managers) can send requests from HRMS
        when they hire someone. Only admins can create the account.
      </p>

      <Dialog onOpenChange={(next) => !next && setOpenId(null)} open={open !== null}>
        {open ? <RequestDetail canWrite={canWrite} request={open} systems={systems} now={clock} busy={busy} resend={() => { void resend(open.id); }} decline={(input) => decline(open.id, input)} /> : null}
      </Dialog>
    </>
  );
}

function RequestDetail({ canWrite, request, systems, now, busy, resend, decline }: { canWrite: boolean; request: AccountRequestRow; systems: AccessSystem[]; now: Date; busy: boolean; resend: () => void; decline: (input: { reason: string; message?: string }) => Promise<string | null> }) {
  const [declining, setDeclining] = useState(false);
  const { groups, untouched } = groupAccess(systems, request.moduleIds);
  const status = STATUS[request.status];
  const sent = new Date(request.createdAt);
  const sentAt = sent.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: PHT });
  const firstName = request.requesterName.split(" ")[0];
  const field = (label: string, value: string) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );

  return (
    <DialogContent className="max-w-180">
      <DialogHeader
        description={`Sent ${relativeDate(request.createdAt, now).toLowerCase()} at ${sentAt} by ${request.requesterName} from ${uiLabel(request.sourceSystemName)}`}
        title={
          <span className="flex items-center gap-2">
            Account request · {request.reference}
            <Badge variant={status.variant}>{status.label}</Badge>
          </span>
        }
      />
      <DialogBody className="flex flex-col gap-4">
        <div className="rounded-xl bg-surface-container-low px-4 py-3.5">
          <p className="text-base font-semibold text-foreground">{request.personName}</p>
          <p className="text-sm text-on-surface-variant">
            {request.workEmail}
            {request.mobile ? ` · ${request.mobile}` : ""}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {field("Requested role", uiLabel(request.roleName))}
          {field("Start date", formatDate(request.startDate))}
          {field("Position", `${request.position} · ${request.branch}`)}
          {field("Account needed by", formatDate(request.neededFrom))}
        </dl>

        {request.note ? (
          <div className="rounded-lg bg-identity-soft px-3.5 py-3 text-sm text-foreground">
            <p className="font-semibold text-identity">Note from {firstName}</p>
            <p>&quot;{request.note}&quot;</p>
          </div>
        ) : null}

        <section aria-label="Access requested" className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-foreground">Access requested</h3>
          {groups.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No access requested.</p>
          ) : (
            groups.map((group) => (
              <div className="flex flex-col gap-2 rounded-lg border border-panel-border px-3.5 py-3" key={group.system}>
                <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <Badge variant="identity">{uiLabel(group.system)}</Badge>
                  {group.requested} of {group.total} modules
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {group.modules.map((module) => (
                    <li key={module.name}>
                      <label className={cn("flex items-center gap-2 text-sm", !module.requested && "text-placeholder")}>
                        <Checkbox checked={module.requested} disabled readOnly />
                        {module.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          {untouched.length ? (
            <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <FigmaIcon name="info-14" />
              No access requested for {untouched.length > 1 ? `${untouched.slice(0, -1).join(", ")} or ${untouched.at(-1)}` : untouched[0]}.
            </p>
          ) : null}
        </section>
      </DialogBody>
      {canWrite ? (
        <DialogFooter>
          {["new", "seen"].includes(request.status) ? <Button onClick={() => setDeclining(true)} size="cta" type="button" variant="row-danger">Decline…</Button> : null}
          {["new", "seen"].includes(request.status) ? (
            <Button asChild size="cta" variant="identity"><Link href={`/admin/users/new?request=${encodeURIComponent(request.id)}`}>Create account <FigmaIcon name="arrow-right" /></Link></Button>
          ) : request.status === "created" ? <Button disabled={busy} onClick={resend} size="cta" type="button" variant="identity">{busy ? "Sending…" : "Resend login details"}</Button> : null}
        </DialogFooter>
      ) : null}
      <Dialog onOpenChange={setDeclining} open={declining}>
        <DeclineDialog onDecline={decline} requester={request.requesterName} />
      </Dialog>
    </DialogContent>
  );
}

const DECLINE_REASONS = ["Already has an account", "Duplicate request", "Details are incorrect", "Not needed anymore", "Other"] as const;

/** Figma "Portal · Decline request dialog". */
function DeclineDialog({ onDecline, requester }: { onDecline: (input: { reason: string; message?: string }) => Promise<string | null>; requester: string }) {
  const [reason, setReason] = useState<string>(DECLINE_REASONS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded-lg border border-panel-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
  async function submit() {
    setBusy(true);
    const message_ = message.trim();
    const failure = await onDecline(message_ ? { reason, message: message_ } : { reason });
    if (failure) toast.error(failure);
    setBusy(false);
  }
  return (
    <DialogContent className="max-w-120">
      <DialogHeader description={`${requester} will be told why so they can send a new one if needed.`} title="Decline this request?" />
      <DialogBody className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
          Reason
          <span className="relative">
            <select className={cn(field, "appearance-none pr-9")} onChange={(event) => setReason(event.target.value)} value={reason}>
              {DECLINE_REASONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
            <FigmaIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" name="chevron-down" />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
          Message to requester (optional)
          <textarea className={cn(field, "min-h-20 resize-none font-normal")} maxLength={5000} onChange={(event) => setMessage(event.target.value)} value={message} />
        </label>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
        <Button disabled={busy} onClick={() => { void submit(); }} type="button" variant="danger">{busy ? "Declining…" : "Decline request"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
