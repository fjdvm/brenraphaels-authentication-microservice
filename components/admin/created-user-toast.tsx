"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** After Add new user redirects back to User management, confirms the new account once as a toast. */
export function CreatedUserToast({ username }: { username: string }) {
  useEffect(() => {
    // A fixed id keeps Strict Mode's double effect and a refresh of the same page to one toast.
    toast.success(`User ${username} was created. Their Username and Temporary password have been emailed to them.`, {
      id: `user-created-${username}`,
    });
  }, [username]);

  return null;
}
