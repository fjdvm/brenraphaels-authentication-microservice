"use client";

import { Bell, CheckCheck, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function NotificationButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className="relative"
        onClick={() => setIsOpen((open) => !open)}
        size="icon"
        title="Notifications"
        type="button"
        variant="ghost"
      >
        <Bell aria-hidden="true" />
        <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
      </Button>
      {isOpen ? (
        <section
          aria-labelledby="notifications-title"
          className="absolute right-0 top-11 z-20 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          role="dialog"
        >
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground" id="notifications-title">Notifications</h2>
            <Button className="h-auto gap-1.5 px-0 py-0 text-xs text-on-surface-variant hover:bg-transparent hover:text-foreground" type="button" variant="ghost">
              <CheckCheck aria-hidden="true" className="size-4" />
              Mark all read
            </Button>
          </div>
          <p className="border-y border-border px-5 py-4 text-center text-xs text-on-surface-variant">
            No notifications yet.
          </p>
          <Button className="h-auto w-full rounded-none px-5 py-3 text-sm font-semibold hover:bg-accent" type="button" variant="ghost">
            View all notifications
          </Button>
        </section>
      ) : null}
    </div>
  );
}

export function PortalActions({
  compact = false,
  showNotifications = true,
}: {
  compact?: boolean;
  showNotifications?: boolean;
}) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsLogoutDialogOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <>
      {showNotifications ? (
        <NotificationButton />
      ) : null}
      <Button aria-label={compact ? "Log out" : undefined} onClick={() => setIsLogoutDialogOpen(true)} size={compact ? "icon" : "default"} type="button" variant="outline">
        {compact ? <LogOut aria-hidden="true" /> : "Log out"}
      </Button>

      {isLogoutDialogOpen
        ? createPortal(
            <div
              aria-describedby="logout-dialog-description"
              aria-labelledby="logout-dialog-title"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 p-4"
              role="dialog"
            >
              <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-primary" id="logout-dialog-title">
                  Log out?
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant" id="logout-dialog-description">
                  Are you sure you want to log out of the Enterprise Suite?
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button onClick={() => setIsLogoutDialogOpen(false)} type="button" variant="outline">
                    Cancel
                  </Button>
                  <form action={logoutAction}>
                    <Button type="submit">Log out</Button>
                  </form>
                </div>
              </div>
            </div>
            ,
            document.body,
          )
        : null}
    </>
  );
}
