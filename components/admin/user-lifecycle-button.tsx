"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";
import { Button } from "@/components/ui/button";

type Props = {
  action: (previous: LifecycleFormState, data: FormData) => Promise<LifecycleFormState>;
  mode: "delete" | "restore";
  userId: string;
  username: string;
};

/** Delete asks for confirmation first; Restore is harmless to undo, so it submits directly. */
export function UserLifecycleButton({ action, mode, userId, username }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [confirming, setConfirming] = useState(false);
  const isDelete = mode === "delete";

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="userId" type="hidden" value={userId} />
      {isDelete && !confirming ? (
        <Button
          aria-label={`Delete ${username}`}
          onClick={() => setConfirming(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      ) : (
        <>
          {isDelete ? (
            <span className="text-xs text-on-surface-variant">
              Delete {username}? They will be signed out and blocked immediately.
            </span>
          ) : null}
          <Button
            aria-label={`${isDelete ? "Confirm delete" : "Restore"} ${username}`}
            disabled={pending}
            size="sm"
            type="submit"
            variant={isDelete ? "destructive" : "outline"}
          >
            {isDelete ? <Trash2 aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            {isDelete ? "Confirm delete" : "Restore"}
          </Button>
          {isDelete ? (
            <Button disabled={pending} onClick={() => setConfirming(false)} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
          ) : null}
        </>
      )}
      {state.error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
