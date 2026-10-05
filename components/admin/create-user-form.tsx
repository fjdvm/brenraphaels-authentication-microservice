"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  isSystemFullySelected,
  toggleModule,
  toggleSystem,
  type SelectableSystem,
} from "@/lib/admin/module-selection";
import {
  initialCreateUserFormState,
  type CreateUserFormState,
} from "@/lib/admin/user-form-state";
import type { RoleOption } from "@/lib/admin/user-form-options";

type CreateUserFormProps = {
  action: (previous: CreateUserFormState, formData: FormData) => Promise<CreateUserFormState>;
  roles: RoleOption[];
  systems: SelectableSystem[];
};

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="text-sm text-danger" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function CreateUserForm({ action, roles, systems }: CreateUserFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialCreateUserFormState);
  // Controlled, so a failed submission never wipes what the Administrator entered.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const { fieldErrors } = state;

  function chooseRole(nextRoleId: string) {
    setRoleId(nextRoleId);
    // The AccessTemplate is only a creation-time starting point for the checkboxes.
    const role = roles.find((candidate) => candidate.id === nextRoleId);
    setModuleIds(role ? [...role.templateModuleIds] : []);
  }

  // Submitting through onSubmit rather than the form `action` prop stops React 19 from
  // resetting the form after the action, which would wipe the Administrator's entries.
  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form className="flex flex-col gap-8" noValidate onSubmit={handleSubmit}>
      {state.error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <section aria-labelledby="user-details-heading" className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary" id="user-details-heading">
          User information
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="firstName">
              First name
            </label>
            <Input
              aria-describedby="firstName-error"
              aria-invalid={fieldErrors.firstName ? true : undefined}
              autoComplete="off"
              id="firstName"
              name="firstName"
              onChange={(event) => setFirstName(event.target.value)}
              value={firstName}
            />
            <FieldError id="firstName-error" message={fieldErrors.firstName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="lastName">
              Last name
            </label>
            <Input
              aria-describedby="lastName-error"
              aria-invalid={fieldErrors.lastName ? true : undefined}
              autoComplete="off"
              id="lastName"
              name="lastName"
              onChange={(event) => setLastName(event.target.value)}
              value={lastName}
            />
            <FieldError id="lastName-error" message={fieldErrors.lastName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              aria-describedby="email-error"
              aria-invalid={fieldErrors.email ? true : undefined}
              autoComplete="off"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
            <FieldError id="email-error" message={fieldErrors.email} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="roleId">
              Role
            </label>
            <select
              aria-describedby="roleId-error"
              aria-invalid={fieldErrors.roleId ? true : undefined}
              className={selectClass}
              id="roleId"
              name="roleId"
              onChange={(event) => chooseRole(event.target.value)}
              value={roleId}
            >
              <option value="">Select a Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <FieldError id="roleId-error" message={fieldErrors.roleId} />
          </div>
        </div>
        <p className="mt-4 text-sm text-on-surface-variant">
          A Temporary password is generated and emailed to the User with their Username. You will not see it.
        </p>
      </section>

      <section aria-labelledby="module-access-heading" className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary" id="module-access-heading">
          Module access
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Choosing a Role pre-checks its usual Modules. Adjust any box before creating the User.
        </p>
        <FieldError id="moduleIds-error" message={fieldErrors.moduleIds} />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {systems.map((system) => (
            <fieldset className="rounded-md border border-border p-4" key={system.id}>
              <legend className="px-1 text-sm font-semibold text-primary">{system.name}</legend>
              <label className="flex items-center gap-2 pb-2 text-sm font-medium">
                <input
                  checked={isSystemFullySelected(system, moduleIds)}
                  className="size-4 accent-primary"
                  onChange={() => setModuleIds((current) => toggleSystem(system, current))}
                  type="checkbox"
                />
                Select all
              </label>
              <div className="flex flex-col gap-2 border-t border-border pt-2">
                {system.modules.map((module) => (
                  <label className="flex items-center gap-2 text-sm" key={module.id}>
                    <input
                      checked={moduleIds.includes(module.id)}
                      className="size-4 accent-primary"
                      name="moduleIds"
                      onChange={() => setModuleIds((current) => toggleModule(current, module.id))}
                      type="checkbox"
                      value={module.id}
                    />
                    {module.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/users">Cancel</Link>
        </Button>
        <div className="sm:w-56">
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Creating…" : "Create user"} {isPending ? <Spinner /> : <span aria-hidden="true">→</span>}
          </button>
        </div>
      </div>
    </form>
  );
}
