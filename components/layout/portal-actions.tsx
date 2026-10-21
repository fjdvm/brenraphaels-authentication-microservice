"use client";

import { Loader2, LogOut, X } from "lucide-react";
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
    <Button aria-busy={pending} disabled={pending} size="cta" type="submit" variant="identity">
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

type LogoutButtonProps = {
  layout: keyof typeof LOGOUT_LAYOUTS;
  /** What logging out ends, under the dialog's title. */
  description: string;
};

export function LogoutButton({ layout, description }: LogoutButtonProps) {
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
              role="dialog"
            >
              <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-surface leading-[normal] shadow-[0_20px_48px_0_rgba(0,0,0,0.2)]">
                <div className="flex items-start gap-3 py-5 pl-6 pr-[18px]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-badge">
                    <LogOut aria-hidden="true" className="size-5 text-identity" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 className="text-lg font-semibold text-foreground" id="logout-dialog-title">
                      Log out?
                    </h2>
                    <p className="text-[13px] text-on-surface-variant" id="logout-dialog-description">
                      {description}
                    </p>
                  </div>
                  <button
                    aria-label="Close"
                    className="rounded-md p-1 text-on-surface-variant outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setIsLogoutDialogOpen(false)}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-[18px]" />
                  </button>
                </div>
                <div className="flex justify-end gap-2 border-t border-dialog-divider bg-dialog-footer px-6 py-3.5">
                  <Button
                    className="text-foreground"
                    onClick={() => setIsLogoutDialogOpen(false)}
                    size="cta"
                    type="button"
                    variant="row-action"
                  >
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
