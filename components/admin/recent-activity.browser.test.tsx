// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AuditLogEntry } from "@/lib/audit/audit-logs";

import { RecentActivity } from "./recent-activity";

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

describe("RecentActivity", () => {
  it("lists the latest activity with its System and time, and links to the Activity log", () => {
    render(
      <RecentActivity
        now={now}
        entries={[
          entry({ id: "1", action: "Updated user access", system: "Portal", description: "Access saved for 2026-FM-008" }),
          entry({ id: "2" }),
        ]}
      />,
    );

    const card = screen.getByRole("region", { name: "Your recent activity" });
    expect(within(card).getByRole("heading", { name: "Your recent activity" })).toBeTruthy();
    expect(within(card).getByRole("link", { name: "View all" }).getAttribute("href")).toBe("/my-logs");
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getByText("Updated user access")).toBeTruthy();
    expect(within(card).getByText("· Portal · Today, 12:30 PM · Access saved for 2026-FM-008")).toBeTruthy();
  });

  it("shows at most the 5 most recent activities", () => {
    const entries = Array.from({ length: 7 }, (_, index) => entry({ id: String(index), action: `Action ${index}` }));
    render(<RecentActivity now={now} entries={entries} />);

    const items = within(screen.getByRole("region", { name: "Your recent activity" })).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(screen.getByText("Action 0")).toBeTruthy();
    expect(screen.queryByText("Action 5")).toBeNull();
  });

  it("says so when there is nothing yet, keeping the link", () => {
    render(<RecentActivity now={now} entries={[]} />);

    expect(screen.getByText("No recent activity yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View all" })).toBeTruthy();
  });
});
