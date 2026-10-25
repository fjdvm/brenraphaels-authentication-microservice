"use client";

import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

type Props = {
  /** Called once the Administrator has chosen to go ahead; the directory shows the change and asks the server. */
  onConfirm: (userId: string) => void;
  mode: "delete" | "restore";
  userId: string;
  username: string;
  /** The User's full name, as the Delete user dialog addresses them. */
  name: string;
};

/** Restore is harmless to undo, so it goes ahead directly. */
function RestoreButton({ onConfirm, userId, username }: Omit<Props, "mode" | "name">) {
  return (
    <Button aria-label={`Restore ${username}`} onClick={() => onConfirm(userId)} size="row" type="button" variant="row-action">
      <RotateCcw aria-hidden="true" />
      Restore
    </Button>
  );
}

/** Figma "Portal · Delete user dialog": Delete asks for confirmation first. */
function DeleteButton({ onConfirm, userId, username, name }: Omit<Props, "mode">) {
  const [open, setOpen] = useState(false);

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
        <DialogBody className="flex flex-col gap-2">
          {/* Deleting always signs the User out everywhere, so Figma's option is ticked and fixed. */}
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <Checkbox checked disabled readOnly />
            Sign them out of every system now
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button size="cta" type="button" variant="row-action">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() => {
              setOpen(false);
              onConfirm(userId);
            }}
            size="cta"
            type="button"
            variant="danger"
          >
            Delete user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserLifecycleButton({ mode, ...props }: Props) {
  return mode === "delete" ? <DeleteButton {...props} /> : <RestoreButton {...props} />;
}
