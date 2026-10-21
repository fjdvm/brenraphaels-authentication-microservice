"use client";

import { Bell, CheckCheck, Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

// Figma: a 32px bell in the admin top bar, 36px in the Staff header, each with an
// 8px dot over the icon's top-right corner.
const NOTIFICATION_SIZES = {
  md: { button: "size-8", dot: "right-1 top-[5px]" },
  lg: { button: "size-9", dot: "right-1.5 top-[7px]" },
} as const;

export function NotificationButton({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof NOTIFICATION_SIZES;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className={cn("relative text-foreground [&_svg:not([class*='size-'])]:size-[18px]", NOTIFICATION_SIZES[size].button)}
        onClick={() => setIsOpen((open) => !open)}
        size="icon"
        title="Notifications"
        type="button"
        variant="ghost"
      >
        <Bell aria-hidden="true" />
        <span aria-hidden="true" className={cn("absolute size-2 rounded-full bg-destructive", NOTIFICATION_SIZES[size].dot)} />
      </Button>
      {isOpen ? (
        <section
          aria-labelledby="notifications-title"
          className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
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

function LogoutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button aria-busy={pending} disabled={pending} type="submit">
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}

// Figma "btn/Log out": full width at the foot of the sidebar, inline in the Staff header.
const LOGOUT_LAYOUTS = {
  sidebar: "w-full py-2.5",
  header: "px-3.5 py-[9px]",
} as const;

export function LogoutButton({ layout }: { layout: keyof typeof LOGOUT_LAYOUTS }) {
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
      <Button
        className={cn("h-auto rounded-lg leading-[normal] text-foreground", LOGOUT_LAYOUTS[layout])}
        onClick={() => setIsLogoutDialogOpen(true)}
        type="button"
        variant="outline"
      >
        <LogOut aria-hidden="true" />
        Log out
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
                    <LogoutSubmitButton />
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
