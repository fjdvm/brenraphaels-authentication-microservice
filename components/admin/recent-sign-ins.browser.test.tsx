// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AuditLogEntry } from "@/lib/audit/audit-logs";

import { RecentSignIns } from "./recent-sign-ins";

const entry = (over: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: "1",
  occurredAt: new Date("2026-11-17T04:30:00Z"),
  system: "Portal",
  action: "Signed in",
  actionValue: "user.login",
  actor: "Jude Nitram",
  target: "Jude Nitram",
  outcome: "SUCCESS",
  description: "Email link confirmed",
  ...over,
});

const now = new Date("2026-11-17T06:00:00Z");

afterEach(cleanup);

describe("RecentSignIns", () => {
  it("lists the latest events with their time and links to the System logs", () => {
    render(
      <RecentSignIns
        now={now}
        entries={[entry({ id: "1", action: "Opened a system", description: "Sign-in handed over to CREOMS" }), entry({ id: "2" })]}
      />,
    );

    const card = screen.getByRole("region", { name: "Your recent sign-ins" });
    expect(within(card).getByRole("heading", { name: "Your recent sign-ins" })).toBeTruthy();
    expect(within(card).getByRole("link", { name: "View system logs" }).getAttribute("href")).toBe("/admin/system-logs");
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getByText("Opened a system")).toBeTruthy();
    expect(within(card).getByText("· Today, 12:30 PM · Sign-in handed over to CREOMS")).toBeTruthy();
  });

  it("says so when there is nothing yet, keeping the link", () => {
    render(<RecentSignIns now={now} entries={[]} />);

    expect(screen.getByText("No recent activity yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View system logs" })).toBeTruthy();
  });
});
