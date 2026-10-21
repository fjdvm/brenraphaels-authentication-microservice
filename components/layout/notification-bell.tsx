"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Inbox, PortalNotification } from "@/lib/notifications/notifications";

const POLL_INTERVAL_MS = 5000;
const MAX_BADGE = 99;

const EMPTY_INBOX: Inbox = { available: false, unread: 0, notifications: [] };

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

/** Polls the Portal's own server about every 5 seconds, and only while the tab is visible. */
function useInbox() {
  const [inbox, setInbox] = useState<Inbox>(EMPTY_INBOX);

  const refresh = useCallback(async () => {
    setInbox(await fetchInbox());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      const next = await fetchInbox();

      if (!cancelled) {
        setInbox(next);
      }
    }

    function stop() {
      clearInterval(timer);
      timer = undefined;
    }

    function start() {
      stop();
      void poll();
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
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

export function NotificationBell({
  className,
  navigate = (link: string) => window.location.assign(link),
}: {
  className?: string;
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

    if (notification.link) {
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
    <div className={`relative ${className ?? ""}`}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative"
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
          className="absolute right-0 top-11 z-20 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
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
              No notifications yet.
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
