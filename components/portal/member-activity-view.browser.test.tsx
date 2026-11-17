// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditFilterOptions, AuditLogEntry } from "@/lib/audit/audit-logs";
import type { SystemLogsResult } from "@/lib/audit/system-logs-query";

import { MemberActivityView } from "./member-activity-view";

const range = { from: "2026-11-11", to: "2026-11-17" };
const options: AuditFilterOptions = {
  systems: [
    { value: "Authentication", label: "Portal" },
    { value: "CRMS", label: "CRMS" },
  ],
  actions: [
    { value: "user.login", label: "Signed in", systems: ["Authentication"] },
    { value: "ticket.replied", label: "Replied to a ticket", systems: ["CRMS"] },
  ],
  modules: [],
};

const entry = (id: string, action: string): AuditLogEntry => ({
  id,
  occurredAt: new Date("2026-11-17T06:31:00Z"),
  system: "Portal",
  action,
  actionValue: "user.login",
  actor: "Fitz",
  target: "",
  outcome: "SUCCESS",
  description: "",
});

const ok = (...entries: AuditLogEntry[]): SystemLogsResult => ({ status: "ok", entries, nextCursor: null });

describe("MemberActivityView", () => {
  afterEach(cleanup);

  it("shows the three Figma filters at their defaults, the table and the warning", () => {
    render(<MemberActivityView defaultRange={range} initial={ok(entry("1", "Signed in"))} load={vi.fn()} options={options} />);

    expect(screen.getByRole("combobox", { name: "System" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Last 7 days/ })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Action" })).toBeTruthy();
    expect(screen.getByText("All systems")).toBeTruthy();
    expect(screen.getByText("All actions")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("Signed in")).toBeTruthy();
    expect(screen.getByText("See something you didn't do? Change your password and tell an Admin.")).toBeTruthy();
  });

  it("asks for the chosen System and shows what comes back", async () => {
    const load = vi.fn(async () => ok(entry("2", "Replied")));
    const user = userEvent.setup();
    render(<MemberActivityView defaultRange={range} initial={ok(entry("1", "Signed in"))} load={load} options={options} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "System" }), "CRMS");

    await waitFor(() => expect(screen.getByText("Replied")).toBeTruthy());
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ source: "CRMS" }));
    expect(screen.queryByText("Signed in")).toBeNull();
  });

  it("offers only the Actions the chosen System can write", async () => {
    const user = userEvent.setup();
    render(<MemberActivityView defaultRange={range} initial={ok(entry("1", "Signed in"))} load={async () => ok()} options={options} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "System" }), "CRMS");

    const actions = within(screen.getByRole("combobox", { name: "Action" })).getAllByRole("option").map((o) => o.textContent);
    expect(actions).toEqual(["All actions", "Replied to a ticket"]);
  });

  it("says so when the service can't be read, and when nothing matches", () => {
    const failed = render(
      <MemberActivityView defaultRange={range} initial={{ status: "error" }} load={vi.fn()} options={null} />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load your activity");
    failed.unmount();

    render(<MemberActivityView defaultRange={range} initial={ok()} load={vi.fn()} options={null} />);
    expect(screen.getByText(/Nothing here/)).toBeTruthy();
  });
});
