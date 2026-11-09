"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Inbox, PortalNotification } from "@/lib/notifications/notifications";

const MAX_BADGE = 99;

const EMPTY_INBOX: Inbox = { available: false, unread: 0, notifications: [] };

/** Only web links are followed: the service accepts any URL, including javascript: ones. */
function isWebLink(link: string) {
  try {
    const { protocol } = new URL(link, window.location.href);

    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});

async function fetchInbox(): Promise<Inbox> {
  try {
    const response = await fetch("/api/notifications", { cache: "no-store" });

    return response.ok ? ((await response.json()) as Inbox) : EMPTY_INBOX;
  } catch {
    return EMPTY_INBOX;
  }
}

/** A connected tab makes requests only on connect, events, or user actions. */
function useInbox() {
  const [inbox, setInbox] = useState<Inbox>(EMPTY_INBOX);
  const refresh = useCallback(async () => {
    setInbox(await fetchInbox());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let revision = 0;

    async function sync() {
      const current = ++revision;
      const next = await fetchInbox();
      if (!cancelled && current === revision) setInbox(next);
    }

    function retry() {
      if (cancelled) return;
      // Only a disconnected tab retries. Jitter spreads reconnects after a deploy.
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5));
      timer = setTimeout(() => void connect(), delay + Math.random() * delay * 0.25);
    }

    async function connect() {
      try {
        const response = await fetch("/api/notifications/live", { method: "POST", cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) return;
        if (!response.ok) throw new Error("Live unavailable");
        const { url } = await response.json();
        if (cancelled) return;
        const connection = new WebSocket(url);
        socket = connection;
        // Fetch after subscribing, so events during catch-up cannot be missed.
        connection.onopen = () => { void sync(); };
        connection.onmessage = (message) => {
          try {
            const event = JSON.parse(message.data);
            if (event.type === "notification.created" || event.type === "notifications.read") {
              failures = 0;
              void sync();
            }
          } catch { /* Ignore unknown frames. */ }
        };
        connection.onerror = () => connection.close();
        connection.onclose = () => { retry(); };
      } catch {
        retry();
      }
    }

    void sync();
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { inbox, setInbox, refresh };
}

async function post(path: string) {
  const response = await fetch(path, { method: "POST" });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

// Figma: a 32px bell in the admin top bar and a 36px one in the Staff header.
const BELL_SIZES = {
  md: "size-8",
  lg: "size-9",
} as const;

export function NotificationBell({
  className,
  size = "md",
  navigate = (link: string) => window.location.assign(link),
}: {
  className?: string;
  size?: keyof typeof BELL_SIZES;
  navigate?: (link: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { inbox, setInbox, refresh } = useInbox();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  async function open(notification: PortalNotification) {
    if (!notification.read) {
      setInbox((current) => ({
        ...current,
        unread: Math.max(0, current.unread - 1),
        notifications: current.notifications.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      }));

      try {
        await post(`/api/notifications/${encodeURIComponent(notification.id)}/read`);
      } catch {
        void refresh();
      }
    }

    if (notification.link && isWebLink(notification.link)) {
      navigate(notification.link);
    }
  }

  async function markAllRead() {
    setInbox((current) => ({
      ...current,
      unread: 0,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    }));

    try {
      await post("/api/notifications/read-all");
    } catch {
      void refresh();
    }
  }

  const unread = inbox.available ? inbox.unread : 0;

  return (
    <div className={cn("relative", className)}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn("relative text-foreground [&_svg:not([class*='size-'])]:size-[18px]", BELL_SIZES[size])}
        onClick={() => setIsOpen((current) => !current)}
        size="icon"
        title="Notifications"
        type="button"
        variant="ghost"
      >
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white"
          >
            {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
          </span>
        ) : null}
      </Button>
      {isOpen ? (
        <section
          aria-labelledby="notifications-title"
          className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          role="dialog"
        >
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground" id="notifications-title">Notifications</h2>
            <Button
              className="h-auto gap-1.5 px-0 py-0 text-xs text-on-surface-variant hover:bg-transparent hover:text-foreground"
              disabled={unread === 0}
              onClick={() => void markAllRead()}
              type="button"
              variant="ghost"
            >
              <CheckCheck aria-hidden="true" className="size-4" />
              Mark all read
            </Button>
          </div>
          {inbox.notifications.length === 0 ? (
            <p className="border-t border-border px-5 py-4 text-center text-xs text-on-surface-variant">
              {inbox.available ? "No notifications yet." : "Notifications are unavailable right now."}
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto border-t border-border">
              {inbox.notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-accent"
                    onClick={() => void open(notification)}
                    type="button"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read ? "bg-transparent" : "bg-destructive"}`}
                      title={notification.read ? undefined : "Unread"}
                    />
                    <span className="min-w-0">
                      <span className={`block truncate text-sm text-foreground ${notification.read ? "" : "font-semibold"}`}>
                        {notification.sendingApp === "CREOMS" ? <span className="mr-2 rounded bg-accent px-1 text-xs">CREOMS</span> : null}{" "}
                        {notification.title}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {dateFormat.format(new Date(notification.createdAt))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
