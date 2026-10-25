"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState, type SyntheticEvent } from "react";

import { ModuleAccessMatrix } from "@/components/admin/module-access-matrix";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { SelectableSystem } from "@/lib/admin/module-selection";
import {
  initialEditUserAccessFormState,
  type EditUserAccessFormState,
} from "@/lib/admin/user-access-form-state";

type EditUserAccessFormProps = {
  action: (previous: EditUserAccessFormState, formData: FormData) => Promise<EditUserAccessFormState>;
  user: {
    id: string;
    roleId: string;
    activeModuleIds: string[];
    firstName: string;
    lastName: string;
    username: string;
    isDeleted: boolean;
  };
  roles: { id: string; name: string }[];
  systems: SelectableSystem[];
};

const USER_MANAGEMENT = "/admin/users";

/**
 * Figma "Portal · Edit access dialog", open over User management. Closing it returns there.
 * The Role picker is not in the Figma frame; it keeps the Administrator's ability to change a Role.
 */
export function EditUserAccessForm({ action, user, roles, systems }: EditUserAccessFormProps) {
  const router = useRouter();
  const [settled, formAction, isPending] = useActionState(action, initialEditUserAccessFormState);
  // An earlier result is not shown while the next save is waiting on the server.
  const state = isPending ? initialEditUserAccessFormState : settled;
  const [roleId, setRoleId] = useState(user.roleId);
  // Changing the Role deliberately leaves the checkboxes alone: only grants decide access.
  const [moduleIds, setModuleIds] = useState(user.activeModuleIds);
  // "Access saved." describes the last submission, so it goes once the Administrator edits again.
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const { fieldErrors } = state;
  const savedRoleName = roles.find((role) => role.id === user.roleId)?.name;

  function close() {
    // A save in flight keeps the dialog open, so its outcome is never lost.
    if (isPending) return;
    router.push(USER_MANAGEMENT, { scroll: false });
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setEditedSinceSave(false);
    startTransition(() => formAction(formData));
  }

  const cancelButton = (
    <Button disabled={isPending} onClick={close} size="cta" type="button" variant="row-action">
      {user.isDeleted ? "Back to users" : "Cancel"}
    </Button>
  );

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : close())} open>
      <DialogContent className="max-w-190">
        <DialogHeader
          description={`${user.username}${savedRoleName ? ` · ${savedRoleName}` : ""}. Changes apply the next time they open a system.`}
          title={`Edit access · ${user.firstName} ${user.lastName}`}
        />

        {user.isDeleted ? (
          <>
            <DialogBody>
              <p className="rounded-lg bg-badge-danger px-4 py-3 text-sm text-badge-danger-foreground" role="status">
                This User is Deleted. Their access cannot be changed until they are restored.
              </p>
            </DialogBody>
            <DialogFooter>{cancelButton}</DialogFooter>
          </>
        ) : (
          <form className="flex min-h-0 flex-col" noValidate onSubmit={handleSubmit}>
            <input name="userId" type="hidden" value={user.id} />
            <DialogBody className="flex flex-col gap-3.5">
              {state.error ? (
                <p className="rounded-lg bg-badge-danger px-4 py-3 text-sm text-badge-danger-foreground" role="alert">
                  {state.error}
                </p>
              ) : null}
              {state.saved && !editedSinceSave ? (
                <p className="rounded-lg bg-badge-success px-4 py-3 text-sm text-badge-success-foreground" role="status">
                  Access saved.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <label className="text-[13px] font-medium text-field-label" htmlFor="roleId">
                  Role
                </label>
                <div className="relative">
                  <select
                    aria-describedby={["roleId-hint", fieldErrors.roleId ? "roleId-error" : null].filter(Boolean).join(" ")}
                    aria-invalid={fieldErrors.roleId ? true : undefined}
                    className="w-60 appearance-none rounded-lg border border-input bg-surface py-2 pr-9 pl-3 text-sm leading-[normal] text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
                    id="roleId"
                    name="roleId"
                    onChange={(event) => {
                      setRoleId(event.target.value);
                      setEditedSinceSave(true);
                    }}
                    value={roleId}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-on-surface-variant"
                  />
                </div>
                <p className="text-xs text-on-surface-variant" id="roleId-hint">
                  Changing a role never changes the modules below.
                </p>
                {fieldErrors.roleId ? (
                  <p className="w-full text-xs text-danger-text" id="roleId-error" role="alert">
                    {fieldErrors.roleId}
                  </p>
                ) : null}
              </div>

              {fieldErrors.moduleIds ? (
                <p className="text-xs text-danger-text" id="moduleIds-error" role="alert">
                  {fieldErrors.moduleIds}
                </p>
              ) : null}
              <ModuleAccessMatrix density="dialog" setSelected={(next) => {
                  setModuleIds(next);
                  setEditedSinceSave(true);
                }}
                selected={moduleIds} systems={systems} />
            </DialogBody>
            <DialogFooter>
              {cancelButton}
              <Button disabled={isPending} size="cta" type="submit" variant="identity">
                {isPending ? "Saving…" : "Save access"} {isPending ? <Spinner /> : null}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
