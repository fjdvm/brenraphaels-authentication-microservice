// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AuditLogEntry } from "@/lib/audit/audit-logs";

import { ActivityTable } from "./activity-table";

const now = new Date("2026-11-17T08:00:00Z");

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: "e1",
    occurredAt: new Date("2026-11-17T06:31:00Z"),
    system: "Portal",
    action: "Signed in",
    actionValue: "user.login",
    actor: "Fitz Martin",
    target: "",
    outcome: "SUCCESS",
    description: "",
    ...overrides,
  };
}

describe("ActivityTable", () => {
  afterEach(cleanup);

  it("has Figma's three columns", () => {
    render(<ActivityTable columns="home" entries={[entry({})]} now={now} />);

    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["What you did", "System", "When"]);
  });

  it("reads each row as what was done, the System in CREOMS naming, and when", () => {
    render(
      <ActivityTable
        columns="log"
        entries={[
          entry({ id: "a", system: "CRMS", action: "Replied", description: "Maria Santos · TKT-208" }),
          entry({ id: "b", action: "Signed in", occurredAt: new Date("2026-11-16T06:00:00Z") }),
        ]}
        now={now}
      />,
    );

    const [, first, second] = screen.getAllByRole("row");
    expect(within(first).getByText("Replied · Maria Santos · TKT-208")).toBeTruthy();
    expect(within(first).getByText("CREOMS")).toBeTruthy();
    expect(within(first).getByText("Today, 2:31 PM")).toBeTruthy();
    expect(within(second).getByText("Signed in")).toBeTruthy();
    expect(within(second).getByText("Portal")).toBeTruthy();
    expect(within(second).getByText(/^Yesterday/)).toBeTruthy();
  });
});
