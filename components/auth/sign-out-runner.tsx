"use client";

import { useEffect, useRef } from "react";

import { logoutAction } from "@/actions/auth";

/**
 * Runs the sign-out as a Server Action, the same call the Log out button makes, so it carries
 * the portal's own Origin and clears the session cookies. A bare GET navigation from a System
 * has neither, which is why the sign-out does not run in a route handler.
 */
export function SignOutRunner() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logoutAction();
  }, []);

  return (
    <p role="status" className="p-6 text-center text-sm text-muted-foreground">
      Signing you out…
    </p>
  );
}
