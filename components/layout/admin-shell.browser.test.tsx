// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
}));

vi.mock("@/components/layout/portal-actions", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
  NotificationButton: () => <button aria-label="Notifications" type="button" />,
}));

import { AdminShell } from "./admin-shell";
import { PortalShell } from "./portal-shell";

const administrator = {
  firstName: "Jude",
  lastName: "Nitram",
  username: "2026-ADMIN-001",
  email: "jude@example.com",
  roleName: "Admin",
};

function setViewport(isMobile: boolean) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: isMobile ? 375 : 1280,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: isMobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("Administrator navigation journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("shows the active administrative destination and collapses on desktop", async () => {
    setViewport(false);
    const user = userEvent.setup();
    render(<AdminShell user={administrator}><div>Page content</div></AdminShell>);

    expect(screen.getByRole("link", { name: "Access" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "User management" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "System logs" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Activity log" }).getAttribute("href")).toBe("/my-logs");
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(document.querySelector('[data-slot="sidebar"][data-state="collapsed"]')).toBeTruthy();
  });

  it("groups the sidebar as MANAGEMENT and AUDIT, with the badge on Account requests", () => {
    setViewport(false);
    render(<AdminShell newAccountRequests={3} user={administrator}><div>Page content</div></AdminShell>);

    const text = document.querySelector('[data-slot="sidebar-content"]')!.textContent!;
    const order = ["Access", "MANAGEMENT", "User management", "Account requests", "AUDIT", "System logs", "Activity log"];
    expect(order.map((label) => text.indexOf(label))).toEqual([...order.map((label) => text.indexOf(label))].sort((a, b) => a - b));
    expect(order.every((label) => text.includes(label))).toBe(true);
    expect(screen.getByLabelText("3 new")).toBeTruthy();
    expect(text).not.toContain("ADMIN");
  });

  it("shows the signed-in Administrator's card with their Role", () => {
    setViewport(false);
    render(<AdminShell user={administrator}><div>Page content</div></AdminShell>);

    const card = screen.getByRole("region", { name: "Signed in as" });
    expect(card.textContent).toContain("JN");
    expect(card.textContent).toContain("Jude Nitram");
    expect(card.textContent).toContain("2026-ADMIN-001");
    expect(card.textContent).toContain("jude@example.com");
    expect(card.textContent).toContain("Admin");
  });

  it("opens a phone drawer that closes with Escape and restores focus", async () => {
    setViewport(true);
    const user = userEvent.setup();
    render(<AdminShell user={administrator}><div>Page content</div></AdminShell>);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps a non-Administrator's logout in the portal header without a sidebar", () => {
    setViewport(false);
    render(
      <PortalShell user={{ firstName: "Fitz", lastName: "Martin", roleName: "Staff/Employee" }}>
        <div>Portal content</div>
      </PortalShell>,
    );

    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("Fitz Martin")).toBeTruthy();
    expect(screen.getByText("Staff/Employee")).toBeTruthy();
    expect(document.querySelector('[data-slot="sidebar"]')).toBeNull();
    for (const label of ["Access", "User management", "System logs"]) {
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
  });
});
