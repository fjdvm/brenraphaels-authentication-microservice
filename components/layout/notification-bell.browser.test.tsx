// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "./notification-bell";

type Item = { sendingApp?: string; id: string; title: string; link: string | null; createdAt: string; read: boolean };

const newest: Item = { id: "n2", title: "Your Role changed", link: null, createdAt: "2026-10-20T08:00:00.000Z", read: false };
const older: Item = { id: "n1", title: "Your access changed", link: "https://crms.test/home", createdAt: "2026-10-19T08:00:00.000Z", read: true };

let inbox: { available: boolean; unread: number; notifications: Item[] };
let fetchMock: ReturnType<typeof vi.fn>;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

const inboxCalls = () => fetchMock.mock.calls.filter(([url, init]) => url === "/api/notifications" && !init?.method).length;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  inbox = { available: true, unread: 1, notifications: [newest, older] };
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ ok: true });
    return Response.json(inbox);
  });
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderBell(navigate = vi.fn()) {
  const view = render(<NotificationBell navigate={navigate} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return { navigate, ...view };
}

describe("NotificationBell", () => {
  it("shows the unread count on the bell", async () => {
    inbox.unread = 3;
    await renderBell();

    expect(screen.getByRole("button", { name: "Notifications, 3 unread" }).textContent).toContain("3");
  });

  it("hides the badge at zero", async () => {
    inbox = { available: true, unread: 0, notifications: [older] };
    await renderBell();

    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(bell.textContent).toBe("");
  });

  it("shows no badge, and keeps working, when the notifications service is unreachable", async () => {
    inbox = { available: false, unread: 0, notifications: [] };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
    expect(screen.getByText("Notifications are unavailable right now.")).toBeTruthy();
  });

  it("tolerates a failed request to the Portal's own server", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    await renderBell();

    expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
  });

  it("lists notifications newest first with title, Philippine date and an unread marker", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    const rows = within(dialog).getAllByRole("button", { name: /Your/ });
    expect(rows[0].textContent).toContain("Your Role changed");
    expect(rows[0].textContent).toContain("Oct 20, 2026");
    expect(rows[1].textContent).toContain("Your access changed");
    expect(within(rows[0]).getByTitle("Unread")).toBeTruthy();
    expect(within(rows[1]).queryByTitle("Unread")).toBeNull();
  });

  it("shows an empty state when there are no notifications", async () => {
    inbox = { available: true, unread: 0, notifications: [] };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("No notifications yet.")).toBeTruthy();
  });

  it("marks a notification read when opened, and follows its link", async () => {
    inbox = { available: true, unread: 1, notifications: [{ ...older, read: false }] };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { navigate } = await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    await user.click(screen.getByRole("button", { name: /Your access changed/ }));

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/n1/read", expect.objectContaining({ method: "POST" }));
    expect(navigate).toHaveBeenCalledWith("https://crms.test/home");
    expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
  });

  it("marks a notification without a link read and stays put", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { navigate } = await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    await user.click(screen.getByRole("button", { name: /Your Role changed/ }));

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/n2/read", expect.objectContaining({ method: "POST" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
  });

  it("does not follow a link that is not a web link", async () => {
    inbox = { available: true, unread: 1, notifications: [{ ...older, link: "javascript:alert(1)", read: false }] };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { navigate } = await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    await user.click(screen.getByRole("button", { name: /Your access changed/ }));

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/n1/read", expect.objectContaining({ method: "POST" }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears the badge with Mark all read", async () => {
    inbox.unread = 2;
    inbox.notifications = [newest, { ...older, read: false }];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read-all", expect.objectContaining({ method: "POST" }));
    expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
    expect(screen.queryByTitle("Unread")).toBeNull();
  });

  it("updates within the polling interval while the tab is visible", async () => {
    await renderBell();
    expect(inboxCalls()).toBe(1);

    inbox = { available: true, unread: 4, notifications: [newest, older] };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(inboxCalls()).toBe(2);
    expect(screen.getByRole("button", { name: "Notifications, 4 unread" })).toBeTruthy();
  });

  it("does not poll while the tab is hidden, and refreshes at once when it returns", async () => {
    await renderBell();
    act(() => setVisibility("hidden"));
    const before = inboxCalls();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(inboxCalls()).toBe(before);

    await act(async () => {
      setVisibility("visible");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(inboxCalls()).toBe(before + 1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(inboxCalls()).toBe(before + 2);
  });

  it("stops polling when removed", async () => {
    const { unmount } = await renderBell();
    unmount();
    const before = inboxCalls();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(inboxCalls()).toBe(before);
  });

  describe("CREOMS copies", () => {
    const copy: Item = {
      ...newest,
      title: "Jane placed Order #7",
      sendingApp: "CREOMS",
      link: "https://creoms.test/orders/7",
    };

    it("badges a CREOMS copy and no other notification", async () => {
      inbox = { available: true, unread: 1, notifications: [copy, older] };
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await renderBell();

      await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

      expect(screen.getAllByText("CREOMS")).toHaveLength(1);
      expect(within(screen.getByRole("button", { name: /Jane placed/ })).getByText("CREOMS")).toBeTruthy();
    });

    it("marks a copy read, un-highlights it and opens the CREOMS page when clicked", async () => {
      inbox = { available: true, unread: 1, notifications: [copy] };
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { navigate } = await renderBell();

      await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
      expect(screen.getByTitle("Unread")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /CREOMS Jane placed/ }));

      expect(fetchMock).toHaveBeenCalledWith("/api/notifications/n2/read", expect.objectContaining({ method: "POST" }));
      expect(screen.queryByTitle("Unread")).toBeNull();
      expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
      expect(navigate).toHaveBeenCalledWith("https://creoms.test/orders/7");
    });

    it("drops the badge number when the alert is read in CREOMS", async () => {
      inbox = { available: true, unread: 1, notifications: [copy] };
      await renderBell();
      expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();

      inbox = { available: true, unread: 0, notifications: [{ ...copy, read: true }] };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
    });
  });
});
