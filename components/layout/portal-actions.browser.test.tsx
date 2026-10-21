// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({ logoutAction: vi.fn() }));

import { logoutAction } from "@/actions/auth";

import { LogoutButton, NotificationButton } from "./portal-actions";

afterEach(cleanup);

describe("NotificationButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens a notification list from the header control", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ available: true, unread: 0, notifications: [] }));
    const user = userEvent.setup();
    render(<NotificationButton />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("No notifications yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeTruthy();
  });
});

describe("LogoutButton", () => {
  const description = "You will be signed out of the portal and CRMS.";

  it("asks for confirmation before logging out, saying what logging out ends", async () => {
    const user = userEvent.setup();
    render(<LogoutButton description={description} layout="header" />);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    const dialog = screen.getByRole("dialog", { name: "Log out?" });
    expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent).toBe(description);
    expect(within(dialog).getByRole("button", { name: "Log out" }).getAttribute("type")).toBe("submit");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Log out?" })).toBeNull();
  });

  it("closes from its close button and from Escape without logging out", async () => {
    const user = userEvent.setup();
    render(<LogoutButton description={description} layout="header" />);

    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Log out?" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Log out?" })).toBeNull();
  });

  it("stays open while signing out", async () => {
    let finish: () => void = () => {};
    vi.mocked(logoutAction).mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<LogoutButton description={description} layout="sidebar" />);

    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(within(screen.getByRole("dialog", { name: "Log out?" })).getByRole("button", { name: "Log out" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Log out?" })).toBeTruthy();
    expect(logoutAction).toHaveBeenCalledTimes(1);
    finish();
  });
});
