"use client";

import { Check, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

type Action = (previous: LifecycleFormState, data: FormData) => Promise<LifecycleFormState>;

type Props = {
  action: Action;
  mode: "delete" | "restore";
  userId: string;
  username: string;
  /** The User's full name, as the Delete user dialog addresses them. */
  name: string;
};

function RefusalMessage({ error }: { error: string | null }) {
  return error ? (
    <p className="w-full text-xs text-destructive" role="alert">
      {error}
    </p>
  ) : null;
}

/** Restore is harmless to undo, so it submits directly. */
function RestoreButton({ action, userId, username }: Omit<Props, "mode" | "name">) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      <input name="userId" type="hidden" value={userId} />
      <Button aria-label={`Restore ${username}`} disabled={pending} size="row" type="submit" variant="row-action">
        <RotateCcw aria-hidden="true" />
        Restore
      </Button>
      <RefusalMessage error={state.error} />
    </form>
  );
}

/** Figma "Portal · Delete user dialog": Delete asks for confirmation first. */
function DeleteButton({ action, userId, username, name }: Omit<Props, "mode">) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<LifecycleFormState, FormData>(async (previous, data) => {
    const next = await action(previous, data);
    if (!next.error) setOpen(false);
    return next;
  }, { error: null });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button aria-label={`Delete ${username}`} onClick={() => setOpen(true)} size="row" type="button" variant="row-danger">
        <Trash2 aria-hidden="true" />
        Delete
      </Button>

      <DialogContent className="max-w-115">
        <DialogHeader
          description={`${username} will no longer be able to log in. You can restore them from the Deleted tab.`}
          icon={<TriangleAlert aria-hidden="true" />}
          title={`Delete ${name}?`}
          tone="danger"
        />
        <form action={formAction}>
          <input name="userId" type="hidden" value={userId} />
          <DialogBody className="flex flex-col gap-2">
            {/* Deleting always signs the User out everywhere; shown as Figma's ticked option. */}
            <p className="flex items-center gap-2.5 text-sm text-foreground">
              <span aria-hidden="true" className="flex size-4.5 items-center justify-center rounded-sm bg-checkbox text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
              Sign them out of every system now
            </p>
            <RefusalMessage error={state.error} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={pending} size="cta" type="button" variant="row-action">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={pending} size="cta" type="submit" variant="danger">
              {pending ? "Deleting…" : "Delete user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserLifecycleButton({ mode, ...props }: Props) {
  return mode === "delete" ? <DeleteButton {...props} /> : <RestoreButton {...props} />;
}
