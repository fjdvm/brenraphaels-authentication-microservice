import { describe, expect, it, vi } from "vitest";

import { createNotificationsClient, createNotifier, readInbox } from "./notifications";

type Call = { url: URL; method: string; headers: Headers; body: unknown };

function stubGateway(
  respond: (call: Call) => Response | Promise<Response>,
) {
  const calls: Call[] = [];
  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: new URL(String(input)),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return respond(call);
  };
  const client = createNotificationsClient({
    baseUrl: "https://gateway.test",
    callerKey: "caller-key",
    app: "Portal",
    fetch: fetchStub as typeof fetch,
  });
  return { calls, client };
}

const stored = {
  id: "3f0c6a52-0f1e-4c3b-9d55-0a1b2c3d4e5f",
  type: "access.changed",
  title: "Your access changed",
  body: "Granted CRMS",
  link: null,
  sendingApp: "Portal",
  targetApp: "Portal",
  userId: "u1",
  createdAt: "2026-10-20T01:00:00.000Z",
  readAt: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("notifications client", () => {
  it("lists a User's notifications for the Portal through the gateway with the Caller key", async () => {
    const { calls, client } = stubGateway(() => json({ notifications: [stored], nextCursor: null }));

    const list = await client.list("u1");

    expect(list).toEqual([
      {
        id: stored.id,
        title: "Your access changed",
        link: null,
        createdAt: "2026-10-20T01:00:00.000Z",
        read: false,
      },
    ]);
    expect(calls[0].url.origin + calls[0].url.pathname).toBe("https://gateway.test/notifications/notifications");
    expect(calls[0].url.searchParams.get("userId")).toBe("u1");
    expect(calls[0].url.searchParams.get("app")).toBe("Portal");
    expect(calls[0].headers.get("authorization")).toBe("Bearer caller-key");
  });

  it("reports a notification with a readAt as read", async () => {
    const { client } = stubGateway(() =>
      json({ notifications: [{ ...stored, readAt: "2026-10-20T02:00:00.000Z" }], nextCursor: null }),
    );

    expect((await client.list("u1"))[0].read).toBe(true);
  });

  it("reads the unread count", async () => {
    const { calls, client } = stubGateway(() => json({ unread: 3 }));

    expect(await client.unreadCount("u1")).toBe(3);
    expect(calls[0].url.pathname).toBe("/notifications/notifications/unread-count");
    expect(calls[0].url.searchParams.get("userId")).toBe("u1");
    expect(calls[0].url.searchParams.get("app")).toBe("Portal");
  });

  it("marks one notification read for that User", async () => {
    const { calls, client } = stubGateway(() => json({ id: stored.id, read: true }));

    await client.markRead("u1", stored.id);

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url.pathname).toBe(`/notifications/notifications/${stored.id}/read`);
    expect(calls[0].body).toEqual({ userId: "u1", app: "Portal" });
  });

  it("marks all of a User's notifications read", async () => {
    const { calls, client } = stubGateway(() => json({ updated: 2 }));

    await client.markAllRead("u1");

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url.pathname).toBe("/notifications/notifications/read-all");
    expect(calls[0].body).toEqual({ userId: "u1", app: "Portal" });
  });

  it("throws when the service answers with an error", async () => {
    const { client } = stubGateway(() => json({ error: "nope" }, 502));

    await expect(client.unreadCount("u1")).rejects.toThrow();
  });
});

describe("createNotifier", () => {
  const message = { userId: "u1", type: "role.changed" as const, title: "Your Role changed", body: "Cashier → CEO" };

  it("sends one notification from the Portal to the User's Portal inbox", async () => {
    const { calls, client } = stubGateway(() => json({ notifications: [stored], stored: 1, connected: 0 }, 201));

    await createNotifier(client)(message);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url.pathname).toBe("/notifications/notifications");
    expect(calls[0].headers.get("authorization")).toBe("Bearer caller-key");
    expect(calls[0].body).toEqual({
      type: "role.changed",
      title: "Your Role changed",
      body: "Cashier → CEO",
      sendingApp: "Portal",
      targetApp: "Portal",
      userIds: ["u1"],
    });
  });

  it("never throws when the service is unreachable or answers with an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = stubGateway(() => {
      throw new TypeError("fetch failed");
    });
    const failing = stubGateway(() => json({ error: "down" }, 503));

    await expect(createNotifier(down.client)(message)).resolves.toBeUndefined();
    await expect(createNotifier(failing.client)(message)).resolves.toBeUndefined();
  });
});

describe("readInbox", () => {
  it("returns the unread count with the notifications", async () => {
    const { client } = stubGateway((call) =>
      call.url.pathname.endsWith("unread-count") ? json({ unread: 1 }) : json({ notifications: [stored], nextCursor: null }),
    );

    const inbox = await readInbox(client, "u1");

    expect(inbox.available).toBe(true);
    expect(inbox.unread).toBe(1);
    expect(inbox.notifications).toHaveLength(1);
  });

  it("shows nothing, and does not throw, when the service is unreachable", async () => {
    const { client } = stubGateway(() => {
      throw new TypeError("fetch failed");
    });

    expect(await readInbox(client, "u1")).toEqual({ available: false, unread: 0, notifications: [] });
  });

  it("shows nothing when the service answers with an error", async () => {
    const { client } = stubGateway(() => json({ error: "down" }, 503));

    expect(await readInbox(client, "u1")).toEqual({ available: false, unread: 0, notifications: [] });
  });

  it("gives up on a hung service rather than hanging the page", async () => {
    const client = createNotificationsClient({
      baseUrl: "https://gateway.test",
      callerKey: "k",
      app: "Portal",
      timeoutMs: 20,
      fetch: ((_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })) as typeof fetch,
    });

    expect((await readInbox(client, "u1")).available).toBe(false);
  });
});
