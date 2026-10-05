"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type SyntheticEvent } from "react";

import { ModuleAccessMatrix } from "@/components/admin/module-access-matrix";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SelectableSystem } from "@/lib/admin/module-selection";
import {
  initialEditUserAccessFormState,
  type EditUserAccessFormState,
} from "@/lib/admin/user-access-form-state";

type EditUserAccessFormProps = {
  action: (previous: EditUserAccessFormState, formData: FormData) => Promise<EditUserAccessFormState>;
  user: { id: string; roleId: string; activeModuleIds: string[] };
  roles: { id: string; name: string }[];
  systems: SelectableSystem[];
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function EditUserAccessForm({ action, user, roles, systems }: EditUserAccessFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialEditUserAccessFormState);
  const [roleId, setRoleId] = useState(user.roleId);
  // Changing the Role deliberately leaves the checkboxes alone: only grants decide access.
  const [moduleIds, setModuleIds] = useState(user.activeModuleIds);
  const { fieldErrors } = state;

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form className="flex flex-col gap-8" noValidate onSubmit={handleSubmit}>
      <input name="userId" type="hidden" value={user.id} />

      {state.error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary" role="status">
          Access saved.
        </p>
      ) : null}

      <section aria-labelledby="role-heading" className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary" id="role-heading">
          Role
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Administrator Roles confer administrative authority. Changing a Role never changes the Modules below.
        </p>
        <div className="mt-4 max-w-sm">
          <label className="sr-only" htmlFor="roleId">
            Role
          </label>
          <select
            aria-describedby="roleId-error"
            aria-invalid={fieldErrors.roleId ? true : undefined}
            className={selectClass}
            id="roleId"
            name="roleId"
            onChange={(event) => setRoleId(event.target.value)}
            value={roleId}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {fieldErrors.roleId ? (
            <p className="mt-1.5 text-sm text-danger" id="roleId-error" role="alert">
              {fieldErrors.roleId}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="module-access-heading" className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary" id="module-access-heading">
          Module access
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Unchecking a Module revokes it; its history is kept.
        </p>
        {fieldErrors.moduleIds ? (
          <p className="mt-2 text-sm text-danger" id="moduleIds-error" role="alert">
            {fieldErrors.moduleIds}
          </p>
        ) : null}
        <ModuleAccessMatrix setSelected={setModuleIds} selected={moduleIds} systems={systems} />
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/users">Back to users</Link>
        </Button>
        <div className="sm:w-56">
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving…" : "Save access"} {isPending ? <Spinner /> : null}
          </button>
        </div>
      </div>
    </form>
  );
}
