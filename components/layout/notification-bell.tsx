"use client";

import { Bell, CheckCheck } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { cn } from "@/lib/utils/cn";
import type { Inbox, PortalNotification } from "@/lib/notifications/notifications";
import { uiLabel } from "@/lib/utils/ui-label";

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

/** Same date and time as the other Systems' bells, e.g. "11/26/2026, 12:26:48 AM", in Philippine time. */
const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
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

/** Figma "Member · Notifications open": account and system notices only; work alerts stay inside each System. */
const isAccountOrSystemNotice = ({ sendingApp }: PortalNotification) => sendingApp == null || sendingApp === "Portal";

/** One panel look in every System (it follows the IMS bell): header, rows with a bell icon, inner scroll. */
function NotificationPanel({
  className,
  inbox,
  unread,
  onMarkAllRead,
  onOpen,
  footer,
}: {
  className: string;
  inbox: Inbox;
  unread: number;
  onMarkAllRead: () => void;
  onOpen: (notification: PortalNotification) => void;
  footer?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="notifications-title"
      className={cn("absolute right-0 top-full z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg", className)}
      role="dialog"
    >
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-base font-semibold text-foreground" id="notifications-title">Notifications</h2>
        <Button
          className="h-auto gap-1.5 px-0 py-0 text-sm font-medium text-identity hover:bg-transparent hover:text-identity/80"
          disabled={unread === 0}
          onClick={onMarkAllRead}
          type="button"
          variant="ghost"
        >
          <CheckCheck aria-hidden="true" className="size-4" />
          Mark all read
        </Button>
      </div>
      {inbox.notifications.length === 0 ? (
        <div className="space-y-1 p-6 text-center text-on-surface-variant">
          <Bell aria-hidden="true" className="mx-auto size-6 opacity-30" />
          <p className="text-sm font-medium">{inbox.available ? "No notifications yet." : "Notifications are unavailable right now."}</p>
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {inbox.notifications.map((notification) => (
            <li key={notification.id}>
              <button
                className={cn(
                  "flex w-full items-start gap-2.5 p-3 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                  !notification.read && "bg-accent/60",
                )}
                onClick={() => onOpen(notification)}
                type="button"
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0 rounded-full border border-border bg-accent p-1.5">
                  <Bell className="size-3.5 text-on-surface-variant" />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block break-words text-sm font-semibold text-foreground">
                    {notification.sendingApp === "CREOMS" ? <span className="mr-2 rounded bg-accent px-1 text-xs">CREOMS</span> : null}{" "}
                    {notification.title}
                  </span>
                  {notification.body ? (
                    <span className="block break-words text-sm text-on-surface-variant">{uiLabel(notification.body)}</span>
                  ) : null}
                  <time className="block text-xs text-on-surface-variant" dateTime={notification.createdAt}>
                    {dateFormat.format(new Date(notification.createdAt))}
                  </time>
                  {notification.read ? null : <span className="sr-only">Unread</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {footer ? <p className="border-t border-border p-3 text-xs text-on-surface-variant">{footer}</p> : null}
    </section>
  );
}

export function NotificationBell({
  className,
  size = "md",
  variant = "admin",
  navigate = (link: string) => window.location.assign(link),
}: {
  className?: string;
  size?: keyof typeof BELL_SIZES;
  /** "member" is the Member top bar's bell and panel, which show account and system notices only. */
  variant?: "admin" | "member";
  navigate?: (link: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { inbox: fullInbox, setInbox, refresh } = useInbox();
  const member = variant === "member";
  const inbox = useMemo<Inbox>(() => {
    if (!member) return fullInbox;
    const notifications = fullInbox.notifications.filter(isAccountOrSystemNotice);

    return { ...fullInbox, notifications, unread: notifications.filter(({ read }) => !read).length };
  }, [fullInbox, member]);

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

  if (member) {
    return (
      <div className={cn("relative", className)}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn(
            "block size-9 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isOpen ? "bg-[#efeff1]" : "hover:bg-[#efeff1]",
          )}
          onClick={() => setIsOpen((current) => !current)}
          title="Notifications"
          type="button"
        >
          <FigmaIcon name={unread > 0 ? "bell-unread" : "bell"} />
        </button>
        {isOpen ? (
          <NotificationPanel
            className="mt-[7px]"
            footer="Only account and system notices appear here. Work alerts stay inside each system."
            inbox={inbox}
            onMarkAllRead={() => void markAllRead()}
            onOpen={(notification) => void open(notification)}
            unread={unread}
          />
        ) : null}
      </div>
    );
  }

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
        <NotificationPanel
          className="mt-2"
          inbox={inbox}
          onMarkAllRead={() => void markAllRead()}
          onOpen={(notification) => void open(notification)}
          unread={unread}
        />
      ) : null}
    </div>
  );
}
