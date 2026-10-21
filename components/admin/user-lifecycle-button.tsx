"use client";

import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    <p className="w-full text-xs text-danger-text" role="alert">
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

type DeleteFormProps = Pick<Props, "action" | "userId"> & {
  onDeleted: () => void;
  onPendingChange: (pending: boolean) => void;
};

/** Mounted only while the dialog is open, so each opening starts without an earlier refusal. */
function DeleteForm({ action, userId, onDeleted, onPendingChange }: DeleteFormProps) {
  const [state, formAction, pending] = useActionState<LifecycleFormState, FormData>(async (previous, data) => {
    const next = await action(previous, data);
    onPendingChange(false);
    if (!next.error) onDeleted();
    return next;
  }, { error: null });

  return (
    // Flagged on submit, not inside the action, whose state updates wait for it to finish.
    <form action={formAction} onSubmit={() => onPendingChange(true)}>
      <input name="userId" type="hidden" value={userId} />
      <DialogBody className="flex flex-col gap-2">
        {/* Deleting always signs the User out everywhere, so Figma's option is ticked and fixed. */}
        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <Checkbox checked disabled readOnly />
          Sign them out of every system now
        </label>
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
  );
}

/** Figma "Portal · Delete user dialog": Delete asks for confirmation first. */
function DeleteButton({ action, userId, username, name }: Omit<Props, "mode">) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    // A delete in flight keeps the dialog open, so its outcome is never lost.
    <Dialog onOpenChange={(next) => deleting || setOpen(next)} open={open}>
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
        <DeleteForm action={action} onDeleted={() => setOpen(false)} onPendingChange={setDeleting} userId={userId} />
      </DialogContent>
    </Dialog>
  );
}

export function UserLifecycleButton({ mode, ...props }: Props) {
  return mode === "delete" ? <DeleteButton {...props} /> : <RestoreButton {...props} />;
}
