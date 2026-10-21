// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({ logoutAction: vi.fn() }));

import { NotificationButton } from "./portal-actions";

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
