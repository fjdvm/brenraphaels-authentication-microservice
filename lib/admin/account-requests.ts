export type AccountRequestStatus = "new" | "seen" | "created" | "declined" | "cancelled";
export type RequestTab = "new" | "created" | "declined" | "all";

/** A request as the Account requests page shows it; dates are ISO strings so it crosses to the client. */
export type AccountRequestRow = {
  id: string;
  reference: string;
  status: AccountRequestStatus;
  sourceSystemName: string;
  personName: string;
  workEmail: string;
  mobile: string | null;
  position: string;
  branch: string;
  startDate: string;
  neededFrom: string;
  note: string | null;
  requesterName: string;
  roleName: string;
  moduleIds: string[];
  createdAt: string;
  accountCreatedAt: string | null;
};

export type AccessSystem = { id: string; name: string; modules: { id: string; name: string }[] };

const TAB_STATUSES: Record<Exclude<RequestTab, "all">, AccountRequestStatus[]> = {
  new: ["new", "seen"],
  created: ["created"],
  declined: ["declined"],
};

export function filterRequests(rows: AccountRequestRow[], tab: RequestTab) {
  return tab === "all" ? rows : rows.filter((row) => TAB_STATUSES[tab].includes(row.status));
}

export function tabCounts(rows: AccountRequestRow[]): Record<RequestTab, number> {
  return {
    new: filterRequests(rows, "new").length,
    created: filterRequests(rows, "created").length,
    declined: filterRequests(rows, "declined").length,
    all: rows.length,
  };
}

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
const monthOf = (date: Date) => new Date(date.getTime() + PHT_OFFSET_MS).toISOString().slice(0, 7);

/** Figma's four cards. "This month" is the Philippine calendar month, as the rest of the Portal shows times. */
export function summarizeRequests(rows: AccountRequestRow[], now: Date) {
  const created = rows.filter((row) => row.status === "created" && row.accountCreatedAt);
  const waits = created.map((row) => new Date(row.accountCreatedAt!).getTime() - new Date(row.createdAt).getTime());

  return {
    new: filterRequests(rows, "new").length,
    createdThisMonth: created.filter((row) => monthOf(new Date(row.accountCreatedAt!)) === monthOf(now)).length,
    declined: filterRequests(rows, "declined").length,
    averageWaitHours: waits.length ? waits.reduce((sum, wait) => sum + wait, 0) / waits.length / 3_600_000 : null,
  };
}

export function formatWait(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 1) return "<1 hr";
  if (hours < 48) return `${Math.round(hours)} hr${Math.round(hours) === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

/** The requested modules grouped by system, as the detail dialog shows them. */
export function groupAccess(systems: AccessSystem[], moduleIds: string[]) {
  const requested = new Set(moduleIds);
  const groups = [];
  const untouched: string[] = [];

  for (const system of systems) {
    const count = system.modules.filter((module) => requested.has(module.id)).length;
    if (!count) {
      untouched.push(system.name);
      continue;
    }
    groups.push({
      system: system.name,
      requested: count,
      total: system.modules.length,
      modules: system.modules.map((module) => ({ name: module.name, requested: requested.has(module.id) })),
    });
  }

  return { groups, untouched };
}
