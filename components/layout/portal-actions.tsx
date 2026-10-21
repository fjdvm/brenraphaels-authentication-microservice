"use client";

import { Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { logoutAction } from "@/actions/auth";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export { NotificationBell as NotificationButton };

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
