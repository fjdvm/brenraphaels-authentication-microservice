// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
}));

vi.mock("@/components/layout/portal-actions", () => ({
  PortalActions: () => <button type="button">Log out</button>,
}));

import { AdminShell } from "./admin-shell";
import { PortalShell } from "./portal-shell";

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
    render(<AdminShell firstName="Jude"><div>Page content</div></AdminShell>);

    expect(screen.getByRole("link", { name: "Access" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "User management" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "System logs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(document.querySelector('[data-slot="sidebar"][data-state="collapsed"]')).toBeTruthy();
  });

  it("opens a phone drawer that closes with Escape and restores focus", async () => {
    setViewport(true);
    const user = userEvent.setup();
    render(<AdminShell firstName="Jude"><div>Page content</div></AdminShell>);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps a non-Administrator's logout in the portal header without a sidebar", () => {
    setViewport(false);
    render(<PortalShell firstName="Ari"><div>Portal content</div></PortalShell>);

    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    expect(document.querySelector('[data-slot="sidebar"]')).toBeNull();
  });
});
