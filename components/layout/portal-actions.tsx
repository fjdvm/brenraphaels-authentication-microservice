"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function PortalActions() {
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
      <Button aria-label="Notifications" size="icon" title="Notifications" variant="outline">
        <Bell aria-hidden="true" />
      </Button>
      <Button onClick={() => setIsLogoutDialogOpen(true)} type="button" variant="outline">
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
