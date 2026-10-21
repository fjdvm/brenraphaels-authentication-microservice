// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SystemLogsView } from "./system-logs-view";

const entries = [
  {
    id: "1",
    occurredAt: new Date("2026-10-06T01:00:00Z"),
    system: "Portal",
    action: "Signed in",
    actor: "Ada Min (2026-ADMIN-001)",
    target: "Ada Min (2026-ADMIN-001)",
    outcome: "SUCCESS" as const,
    description: "Ada Min (2026-ADMIN-001): Signed in.",
  },
  {
    id: "2",
    occurredAt: new Date("2026-10-06T00:00:00Z"),
    system: "CRMS",
    action: "Failed sign-in",
    actor: "Unauthenticated visitor",
    target: "Portal",
    outcome: "FAILURE" as const,
    description: "Unauthenticated visitor: Failed sign-in (failed) - Unknown Username.",
  },
];

describe("SystemLogsView", () => {
  afterEach(cleanup);

  it("shows actor, action, target, time and a truthful outcome for each event", () => {
    render(<SystemLogsView entries={entries} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Success")).toBeTruthy();
    expect(within(rows[0]).getByText("Portal")).toBeTruthy();
    expect(within(rows[0]).getAllByText("Ada Min (2026-ADMIN-001)")).toHaveLength(2);
    expect(within(rows[1]).getByText("Failed")).toBeTruthy();
    expect(within(rows[1]).getByText("Unauthenticated visitor")).toBeTruthy();
    expect(within(rows[1]).getByText(/Unknown Username/)).toBeTruthy();
    expect(within(rows[0]).getByRole("time").getAttribute("datetime")).toBe(
      "2026-10-06T01:00:00.000Z",
    );
  });

  it("explains an empty log", () => {
    render(<SystemLogsView entries={[]} />);

    expect(screen.getByText("No activity recorded yet")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error state instead of an empty log when reading fails", () => {
    render(<SystemLogsView entries={null} />);

    expect(screen.getByRole("alert").textContent).toContain("Couldn't load System Logs");
    expect(screen.queryByText("No activity recorded yet")).toBeNull();
  });
});
