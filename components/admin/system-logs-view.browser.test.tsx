// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditFilterOptions, AuditLogEntry } from "@/lib/audit/audit-logs";
import type { SystemLogsResult } from "@/lib/audit/system-logs-query";

import { SystemLogsView } from "./system-logs-view";

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: "1",
  occurredAt: new Date("2026-10-06T01:00:00Z"),
  system: "Portal",
  action: "Signed in",
  actionValue: "user.login",
  actor: "Ada Min (2026-ADMIN-001)",
  target: "Ada Min (2026-ADMIN-001)",
  outcome: "SUCCESS",
  description: "Ada Min (2026-ADMIN-001): Signed in.",
  ...over,
});

const entries = [
  entry(),
  entry({
    id: "2",
    occurredAt: new Date("2026-10-06T00:00:00Z"),
    system: "CRMS",
    action: "Failed sign-in",
    actionValue: "user.login_failed",
    actor: "Unauthenticated visitor",
    target: "Portal",
    outcome: "FAILURE",
    description: "Unauthenticated visitor: Failed sign-in (failed) - Unknown Username.",
  }),
];

const options: AuditFilterOptions = {
  systems: [
    { value: "CRMS", label: "CRMS" },
    { value: "Authentication", label: "Portal" },
  ],
  actions: [
    { value: "record.created", label: "record.created", systems: ["CRMS"] },
    { value: "user.login", label: "Signed in", systems: ["Authentication"] },
    { value: "user.login_failed", label: "Failed sign-in", systems: ["Authentication"] },
  ],
  modules: [
    { value: "Marketing", systems: ["CRMS"] },
    { value: "Feedback", systems: ["CRMS"] },
  ],
};

const range = { from: "2026-10-15", to: "2026-10-21" };
const ok = (list: AuditLogEntry[], nextCursor: string | null = null): SystemLogsResult => ({
  status: "ok",
  entries: list,
  nextCursor,
});

afterEach(cleanup);

/** The From and To inputs sit behind the date-range button, as in Figma. */
function openDates() {
  fireEvent.click(screen.getByRole("button", { name: /^Date range/ }));
}

function setup(initial: SystemLogsResult = ok(entries), load = vi.fn().mockResolvedValue(ok(entries))) {
  render(<SystemLogsView initial={initial} options={options} defaultRange={range} load={load} />);
  return { load, user: userEvent.setup() };
}

describe("SystemLogsView rows", () => {
  it("shows actor, action, detail, time and a truthful outcome for each event", () => {
    setup();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Success")).toBeTruthy();
    expect(within(rows[0]).getByText("Portal")).toBeTruthy();
    expect(within(rows[0]).getByText("Ada Min (2026-ADMIN-001)")).toBeTruthy();
    expect(within(rows[0]).getByText("Ada Min (2026-ADMIN-001): Signed in.")).toBeTruthy();
    expect(within(rows[1]).getByText("Failed")).toBeTruthy();
    expect(within(rows[1]).getByText("Unauthenticated visitor")).toBeTruthy();
    expect(within(rows[1]).getByText(/Unknown Username/)).toBeTruthy();
    expect(within(rows[0]).getByRole("time").getAttribute("datetime")).toBe("2026-10-06T01:00:00.000Z");
  });

  it.each(["all", "mine"] as const)("renders Announcement and Feedback events in %s logs", (scope) => {
    render(<SystemLogsView
      initial={ok([
        entry({ id: "announcement", system: "CRMS", action: "Created record", actionValue: "record.created", actor: "Sam Staff", description: 'Sam Staff saved the Draft "Ube restock".' }),
        entry({ id: "analysis", system: "CRMS", action: "Ran Feedback analysis", actionValue: "feedback.analysis_run", actor: "Sam Staff", outcome: "FAILURE", description: "Sam Staff could not run Feedback analysis." }),
      ])}
      options={options}
      defaultRange={range}
      load={vi.fn()}
      scope={scope}
    />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Created record")).toBeTruthy();
    expect(within(rows[0]).getByText('Sam Staff saved the Draft "Ube restock".')).toBeTruthy();
    expect(within(rows[0]).getByText("Success")).toBeTruthy();
    expect(within(rows[1]).getByText("Ran Feedback analysis")).toBeTruthy();
    expect(within(rows[1]).getByText("Sam Staff could not run Feedback analysis.")).toBeTruthy();
    expect(within(rows[1]).getByText("Failed")).toBeTruthy();
    if (scope === "all") expect(within(rows[0]).getByText("Sam Staff")).toBeTruthy();
  });

  it("shows times in Philippine time, naming today and yesterday", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 7:30 AM on Oct 7 in Manila: the first event is yesterday there, though still Oct 6 in UTC.
    vi.setSystemTime(new Date("2026-10-06T23:30:00Z"));
    try {
      setup(
        ok([
          entry({ id: "a", occurredAt: new Date("2026-10-06T22:15:00Z") }),
          entry({ id: "b", occurredAt: new Date("2026-10-06T01:00:00Z") }),
          entry({ id: "c", occurredAt: new Date("2026-10-01T08:05:00Z") }),
          entry({ id: "d", occurredAt: new Date("2025-12-31T15:00:00Z") }),
        ]),
      );

      const times = screen.getAllByRole("time").map((t) => t.textContent);
      expect(times).toEqual(["Today, 6:15 AM", "Yesterday, 9:00 AM", "Oct 1, 4:05 PM", "Dec 31, 2025, 11:00 PM"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("has the Figma columns, with the description as the Detail", () => {
    setup();

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Time", "User", "Action", "System", "Outcome", "Detail"]);
  });

  it("falls back to the Target, then a dash, when an event has no description", () => {
    setup(ok([entry({ id: "a", description: "", target: "Order 42" }), entry({ id: "b", description: "", target: "" })]));

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Order 42")).toBeTruthy();
    expect(within(rows[1]).getByText("—")).toBeTruthy();
  });

  it("names an event with no recorded actor Unknown", () => {
    setup(ok([entry({ actor: "" })]));

    expect(within(screen.getAllByRole("row")[1]).getByText("Unknown")).toBeTruthy();
  });

  it("explains an empty result and keeps the filters", () => {
    setup(ok([]));

    expect(screen.getByText("No events match")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByLabelText("Outcome")).toBeTruthy();
  });
});

describe("SystemLogsView filters", () => {
  it("starts on the last 7 days without asking the service again", () => {
    const { load } = setup();

    expect(screen.getByRole("button", { name: /^Date range/ }).textContent).toContain("Last 7 days");
    openDates();
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-10-15");
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("2026-10-21");
    expect(load).not.toHaveBeenCalled();
  });

  it("lists the Portal under its name, with every Source", () => {
    setup();

    const system = screen.getByLabelText("System");
    expect(within(system).getAllByRole("option").map((o) => o.textContent)).toEqual(["All systems", "CRMS", "Portal"]);
  });

  it("offers the actions of the chosen System only", async () => {
    const { user } = setup();
    const action = screen.getByLabelText("Action");
    const names = () => within(action).getAllByRole("option").map((o) => o.textContent);

    expect(names()).toEqual(["All actions", "record.created", "Signed in", "Failed sign-in"]);

    await user.selectOptions(screen.getByLabelText("System"), "Authentication");

    expect(names()).toEqual(["All actions", "Signed in", "Failed sign-in"]);
  });

  it("filters CRMS events by Module, and drops it under a System that has none", async () => {
    const { load, user } = setup();
    const module = screen.getByLabelText("Module");

    expect(within(module).getAllByRole("option").map((o) => o.textContent)).toEqual(["All modules", "Marketing", "Feedback"]);

    await user.selectOptions(screen.getByLabelText("System"), "CRMS");
    await user.selectOptions(module, "Marketing");
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ source: "CRMS", module: "Marketing" })));

    await user.selectOptions(screen.getByLabelText("System"), "Authentication");
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.not.objectContaining({ module: "Marketing" })));
  });

  it("narrows by each filter, and the filters combine", async () => {
    const { load, user } = setup();

    await user.selectOptions(screen.getByLabelText("System"), "Authentication");
    await user.selectOptions(screen.getByLabelText("Action"), "user.login_failed");
    await user.selectOptions(screen.getByLabelText("Outcome"), "FAILURE");
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "ada{Enter}");

    await waitFor(() => expect(load).toHaveBeenCalledTimes(4));
    expect(load).toHaveBeenLastCalledWith({
      source: "Authentication",
      action: "user.login_failed",
      outcome: "FAILURE",
      q: "ada",
      from: "2026-10-15T00:00:00.000+08:00",
      to: "2026-10-21T23:59:59.999+08:00",
    });
  });

  it("applies text typed into Search together with the next filter change", async () => {
    const { load, user } = setup();

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "ada");
    await user.selectOptions(screen.getByLabelText("Outcome"), "FAILURE");

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ q: "ada", outcome: "FAILURE" }));
  });

  it("drops an action the new System cannot write", async () => {
    const { load, user } = setup();

    await user.selectOptions(screen.getByLabelText("Action"), "record.created");
    await user.selectOptions(screen.getByLabelText("System"), "Authentication");

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load.mock.lastCall![0]).toMatchObject({ source: "Authentication" });
    expect(load.mock.lastCall![0].action).toBeUndefined();
  });

  it("filters by the dates the Administrator picks, in Philippine days", async () => {
    const { load } = setup();

    openDates();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenCalledWith({
      from: "2026-10-01T00:00:00.000+08:00",
      to: "2026-10-21T23:59:59.999+08:00",
    });
    expect(screen.getByRole("button", { name: /^Date range/ }).textContent).toContain("Oct 1 – Oct 21");
  });

  it("does not ask the service for a range that ends before it starts", async () => {
    const { load } = setup();

    openDates();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-30" } });

    expect(screen.getByText("From must be on or before To")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the new result and goes back to the first page when a filter changes", async () => {
    const { load, user } = setup(ok(entries, "c1"), vi.fn().mockResolvedValue(ok([entry({ id: "9", actor: "Only Match" })])));

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.selectOptions(screen.getByLabelText("Outcome"), "SUCCESS");

    expect(await screen.findByText("Only Match")).toBeTruthy();
    expect(load.mock.lastCall![0].cursor).toBeUndefined();
    expect(screen.getByText("Showing 1–1")).toBeTruthy();
  });
});

describe("SystemLogsView paging", () => {
  const pages: Record<string, SystemLogsResult> = {
    c1: ok([entry({ id: "3", actor: "Page Two A" }), entry({ id: "4", actor: "Page Two B" }), entry({ id: "5", actor: "Page Two C" })], "c2"),
    c2: ok([entry({ id: "6", actor: "Page Three" })], null),
  };
  const load = () => vi.fn(async (q: { cursor?: string | null }) => (q.cursor ? pages[q.cursor] : ok(entries, "c1")));

  it("shows the range without a total", () => {
    setup(ok(entries, "c1"));

    expect(screen.getByText("Showing 1–2")).toBeTruthy();
  });

  it("pages forward with the service cursor and back through the cursors already visited", async () => {
    const fn = load();
    const { user } = setup(ok(entries, "c1"), fn);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page Two A")).toBeTruthy();
    expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c1" }));
    expect(screen.getByText("Showing 3–5")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page Three")).toBeTruthy();
    expect(screen.getByText("Showing 6–6")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Page Two A")).toBeTruthy();
    expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c1" }));
    expect(screen.getByText("Showing 3–5")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Ada Min (2026-ADMIN-001): Signed in.")).toBeTruthy();
    expect(fn.mock.lastCall![0].cursor).toBeUndefined();
    expect(screen.getByText("Showing 1–2")).toBeTruthy();
  });

  it("disables Previous on the first page and Next at the end", async () => {
    const { user } = setup(ok(entries, "c1"), load());

    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("Page Three");

    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Next when the first page is also the last", () => {
    setup(ok(entries, null));

    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SystemLogsView when the service cannot be reached", () => {
  it("shows an inline error with Retry, no rows, and keeps the filters", () => {
    setup({ status: "error" });

    expect(screen.getByRole("alert").textContent).toContain("Couldn't load System logs");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/Showing/)).toBeNull();
    expect(screen.getByLabelText("System")).toBeTruthy();
  });

  it("replaces the rows with the error instead of showing stale data when a later load fails", async () => {
    const { user } = setup(ok(entries), vi.fn().mockResolvedValue({ status: "error" }));

    await user.selectOptions(screen.getByLabelText("Outcome"), "FAILURE");

    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load System logs");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("treats a rejected load as an error too", async () => {
    const { user } = setup(ok(entries), vi.fn().mockRejectedValue(new Error("boom")));

    await user.selectOptions(screen.getByLabelText("Outcome"), "FAILURE");

    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("retries the same query and shows the result", async () => {
    const load = vi.fn().mockResolvedValueOnce({ status: "error" }).mockResolvedValueOnce(ok(entries));
    const { user } = setup(ok(entries), load);

    await user.selectOptions(screen.getByLabelText("Outcome"), "FAILURE");
    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1][0]).toEqual(load.mock.calls[0][0]);
  });
});

describe("SystemLogsView Export CSV", () => {
  function setupExport(exportCsv = vi.fn().mockResolvedValue({ status: "ok" }), canExport = true) {
    const load = vi.fn().mockResolvedValue(ok(entries, "c1"));
    render(
      <SystemLogsView
        initial={ok(entries, "c1")}
        options={options}
        defaultRange={range}
        load={load}
        canExport={canExport}
        exportCsv={exportCsv}
      />,
    );
    return { exportCsv, load, user: userEvent.setup() };
  }

  it("is offered to Administrators only", () => {
    setupExport(vi.fn(), false);

    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });

  it("exports the applied filters and date range, not just the page on screen", async () => {
    const { exportCsv, user } = setupExport();

    await user.selectOptions(screen.getByLabelText("System"), "Authentication");
    await user.selectOptions(screen.getByLabelText("Outcome"), "FAILURE");
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "ada{Enter}");
    await user.click(await screen.findByRole("button", { name: "Next" }));
    // Text typed but not applied is not what the screen shows.
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "x");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(exportCsv).toHaveBeenCalledOnce();
    expect(exportCsv).toHaveBeenCalledWith({
      source: "Authentication",
      outcome: "FAILURE",
      q: "ada",
      from: "2026-10-15T00:00:00.000+08:00",
      to: "2026-10-21T23:59:59.999+08:00",
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks to narrow the date range when the export is over the cap", async () => {
    const { user } = setupExport(vi.fn().mockResolvedValue({ status: "too_large" }));

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/narrow the date range/i);
  });

  it("explains a failed export", async () => {
    const { user } = setupExport(vi.fn().mockRejectedValue(new Error("offline")));

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't export/i);
  });

  it("needs a whole, valid date range", () => {
    setupExport();

    openDates();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "" } });
    expect((screen.getByRole("button", { name: "Export CSV" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-01" } });
    expect((screen.getByRole("button", { name: "Export CSV" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SystemLogsView as My Logs", () => {
  function setupMine(initial: SystemLogsResult = ok(entries), load = vi.fn().mockResolvedValue(ok(entries))) {
    render(<SystemLogsView initial={initial} options={options} defaultRange={range} load={load} scope="mine" />);
    return { load, user: userEvent.setup() };
  }

  it("has no User column, since every row is the viewer's own", () => {
    setupMine();

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Time", "Action", "System", "Outcome", "Detail"]);
    expect(within(screen.getAllByRole("row")[2]).queryByText("Unauthenticated visitor")).toBeNull();
  });

  it("offers no Export", () => {
    setupMine();

    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /export/i })).toBeNull();
  });

  it("never offers Export, even if asked to", () => {
    render(
      <SystemLogsView initial={ok(entries)} options={options} defaultRange={range} load={vi.fn()} scope="mine" canExport />,
    );

    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
  });

  it("offers only search and the date range: no System, Action or Outcome filter", () => {
    setupMine();

    expect(screen.getByRole("searchbox", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Date range/ })).toBeTruthy();
    expect(screen.queryByLabelText("System")).toBeNull();
    expect(screen.queryByLabelText("Action")).toBeNull();
    expect(screen.queryByLabelText("Outcome")).toBeNull();
  });

  it("searches and pages the same way", async () => {
    const { load, user } = setupMine(ok(entries, "c1"));

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "signed{Enter}");
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenLastCalledWith({
      q: "signed",
      from: "2026-10-15T00:00:00.000+08:00",
      to: "2026-10-21T23:59:59.999+08:00",
    });
  });

  it("shows the inline error with Retry and no stale rows", async () => {
    const load = vi.fn().mockResolvedValueOnce({ status: "error" }).mockResolvedValue(ok(entries));
    const { user } = setupMine(ok(entries), load);

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "signed{Enter}");

    expect(await screen.findByText("Couldn't load your activity")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeTruthy();
  });
});
