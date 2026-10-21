"use client";

import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { logoutAction } from "@/actions/auth";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
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

// Figma "Portal · Log out dialog". The Staff header's copy is finished with the Staff log out dialog.
const LOGOUT_DESCRIPTIONS = {
  sidebar: "You will be signed out of the portal and every system you opened (CRMS, HRMS, IMS, POS).",
  header: "You will be signed out of the portal and every system you opened.",
} as const;

export function LogoutButton({ layout }: { layout: keyof typeof LOGOUT_LAYOUTS }) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  return (
    <Dialog onOpenChange={setIsLogoutDialogOpen} open={isLogoutDialogOpen}>
      <Button
        className={cn("h-auto rounded-lg leading-[normal] text-foreground", LOGOUT_LAYOUTS[layout])}
        onClick={() => setIsLogoutDialogOpen(true)}
        type="button"
        variant="outline"
      >
        <LogOut aria-hidden="true" />
        Log out
      </Button>

      <DialogContent className="max-w-110">
        <DialogHeader description={LOGOUT_DESCRIPTIONS[layout]} icon={<LogOut aria-hidden="true" />} title="Log out?" />
        <DialogFooter>
          <DialogClose asChild>
            <Button size="cta" type="button" variant="row-action">
              Cancel
            </Button>
          </DialogClose>
          <form action={logoutAction}>
            <LogoutSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
