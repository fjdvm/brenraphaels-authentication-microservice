/** A notification as the bell shows it; the service's other fields stay on the server. */
export type PortalNotification = {
  id: string;
  title: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

export type Inbox = {
  /** False when the notifications service could not be read; the bell then shows nothing. */
  available: boolean;
  unread: number;
  notifications: PortalNotification[];
};

/** A notification the Portal sends to one User's Portal inbox. */
export type OutgoingNotification = {
  userId: string;
  type: string;
  title: string;
  body: string;
};

/** Sends a notification on a best-effort basis. Never throws. */
export type Notifier = (notification: OutgoingNotification) => Promise<void>;

export type NotificationsClient = {
  send(notification: OutgoingNotification): Promise<void>;
  list(userId: string): Promise<PortalNotification[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
};

type ClientConfig = {
  /** The api-gateway origin; the service sits under its /notifications prefix. */
  baseUrl: string;
  /** The Portal's Caller key for the gateway. Server-side only. */
  callerKey: string;
  /** The notifications service's name for the Portal, as target App. */
  app: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 3000;
const LIST_LIMIT = 20;

export function createNotificationsClient(config: ClientConfig): NotificationsClient {
  const base = `${config.baseUrl.replace(/\/+$/, "")}/notifications/notifications`;
  const doFetch = config.fetch ?? fetch;

  async function call(path: string, init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> }) {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await doFetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${config.callerKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Notifications service answered ${response.status}`);
    }

    return response.json();
  }

  return {
    async send({ userId, ...message }) {
      await call("", {
        method: "POST",
        body: { ...message, sendingApp: config.app, targetApp: config.app, userIds: [userId] },
      });
    },
    async list(userId) {
      const body = await call("", { method: "GET", query: { userId, app: config.app, limit: String(LIST_LIMIT) } });

      return (body.notifications as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        link: typeof row.link === "string" ? row.link : null,
        createdAt: String(row.createdAt),
        read: row.readAt != null,
      }));
    },
    async unreadCount(userId) {
      const body = await call("/unread-count", { method: "GET", query: { userId, app: config.app } });

      return Number(body.unread);
    },
    async markRead(userId, notificationId) {
      await call(`/${encodeURIComponent(notificationId)}/read`, { method: "POST", body: { userId, app: config.app } });
    },
    async markAllRead(userId) {
      await call("/read-all", { method: "POST", body: { userId, app: config.app } });
    },
  };
}

/** The bell's view of a User's inbox. Never throws: an unreachable service just means no badge. */
export async function readInbox(client: NotificationsClient, userId: string): Promise<Inbox> {
  try {
    const [unread, notifications] = await Promise.all([client.unreadCount(userId), client.list(userId)]);

    return { available: true, unread, notifications };
  } catch (error) {
    console.error("Notifications unavailable", error);

    return { available: false, unread: 0, notifications: [] };
  }
}

/** A failed send is logged and dropped, so it can never fail the action that caused it. */
export function createNotifier(client: NotificationsClient): Notifier {
  return async (notification) => {
    try {
      await client.send(notification);
    } catch (error) {
      console.error("Could not send a notification", error);
    }
  };
}
