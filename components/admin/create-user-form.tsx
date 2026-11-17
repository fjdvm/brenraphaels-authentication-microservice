"use client";

import { ArrowRight, ChevronDown, Info } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type ReactNode, type SyntheticEvent } from "react";

import { ModuleAccessMatrix } from "@/components/admin/module-access-matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { summarizeSelection, type SelectableSystem } from "@/lib/admin/module-selection";
import {
  initialCreateUserFormState,
  type CreateUserFormState,
} from "@/lib/admin/user-form-state";
import type { RoleOption } from "@/lib/admin/user-form-options";
import { cn } from "@/lib/utils/cn";
import { uiLabel } from "@/lib/utils/ui-label";

type CreateUserFormProps = {
  action: (previous: CreateUserFormState, formData: FormData) => Promise<CreateUserFormState>;
  roles: RoleOption[];
  systems: SelectableSystem[];
  request?: { id: string; reference: string; requesterName: string; note: string | null; firstName: string; lastName: string; email: string; roleId: string; moduleIds: string[] };
};

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="text-xs text-danger-text" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

/** Figma form field: label with a red required mark, the control, then a hint or the error. */
function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex gap-0.75 text-[13px] font-medium">
        <label className="text-field-label" htmlFor={id}>
          {label}
        </label>
        <span aria-hidden="true" className="text-danger-text">
          *
        </span>
      </div>
      {children}
      {hint ? (
        <p className="text-xs text-on-surface-variant" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

const fieldClass =
  "h-auto rounded-lg border-input bg-surface px-3 py-2.5 text-sm leading-[normal] text-foreground shadow-none md:text-sm";
const panelClass = "flex flex-col gap-3.5 rounded-xl border border-panel-border bg-surface px-5 py-4.5 leading-[normal]";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Figma "Portal · Add new user": User information, System access and the action bar. */
export function CreateUserForm({ action, roles, systems, request }: CreateUserFormProps) {
  const [settled, formAction, isPending] = useActionState(action, initialCreateUserFormState);
  // An earlier result is not shown while the next submission is waiting on the server.
  const state = isPending ? initialCreateUserFormState : settled;
  // Controlled, so a failed submission never wipes what the Administrator entered.
  const [firstName, setFirstName] = useState(request?.firstName ?? "");
  const [lastName, setLastName] = useState(request?.lastName ?? "");
  const [email, setEmail] = useState(request?.email ?? "");
  const [roleId, setRoleId] = useState(request?.roleId ?? "");
  const [moduleIds, setModuleIds] = useState<string[]>(request?.moduleIds ?? []);
  const { fieldErrors } = state;
  const selection = summarizeSelection(systems, moduleIds);
  const matchesRequest = Boolean(request) && request!.roleId === roleId && request!.moduleIds.length === moduleIds.length && request!.moduleIds.every((id) => moduleIds.includes(id));

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

  const describedBy = (id: string, hasHint = false) =>
    [hasHint ? `${id}-hint` : null, fieldErrors[id as keyof typeof fieldErrors] ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form className="flex flex-1 flex-col" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 px-6 pt-4 pb-7 md:px-8">
        {request ? (
          <div className="flex items-center gap-3 rounded-lg border border-panel-border bg-identity-soft px-4 py-3 text-sm text-identity">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Filled in from request {request.reference}</p>
              <p className="text-xs">Sent by {request.requesterName}{request.note ? `: “${request.note}”` : ""}. Check the details, then create the account.</p>
            </div>
            <Link className="shrink-0 text-[13px] font-semibold" href="/admin/account-requests">View request</Link>
          </div>
        ) : null}
        {state.error ? (
          <p className="rounded-lg bg-badge-danger px-4 py-3 text-sm text-badge-danger-foreground" role="alert">
            {state.error}
          </p>
        ) : null}

        <section aria-labelledby="user-details-heading" className={panelClass}>
          <h2 className="text-[15px] font-semibold text-foreground" id="user-details-heading">
            User information
          </h2>
          <div className="flex flex-col gap-4 md:flex-row">
            <Field error={fieldErrors.firstName} id="firstName" label="First name">
              <Input
                aria-describedby={describedBy("firstName")}
                aria-invalid={fieldErrors.firstName ? true : undefined}
                aria-required="true"
                autoComplete="off"
                className={fieldClass}
                id="firstName"
                name="firstName"
                onChange={(event) => setFirstName(event.target.value)}
                value={firstName}
              />
            </Field>
            <Field error={fieldErrors.lastName} id="lastName" label="Last name">
              <Input
                aria-describedby={describedBy("lastName")}
                aria-invalid={fieldErrors.lastName ? true : undefined}
                aria-required="true"
                autoComplete="off"
                className={fieldClass}
                id="lastName"
                name="lastName"
                onChange={(event) => setLastName(event.target.value)}
                value={lastName}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <Field error={fieldErrors.email} hint="Their username and temporary password are sent here." id="email" label="Email">
              <Input
                aria-describedby={describedBy("email", true)}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-required="true"
                autoComplete="off"
                className={fieldClass}
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                readOnly={Boolean(request)}
                type="email"
                value={email}
              />
            </Field>
            <Field
              error={fieldErrors.roleId}
              hint={`Roles: ${roles.map((role) => uiLabel(role.name)).join(", ")}`}
              id="roleId"
              label="Role"
            >
              <div className="relative">
                <select
                  aria-describedby={describedBy("roleId", true)}
                  aria-invalid={fieldErrors.roleId ? true : undefined}
                  aria-required="true"
                  className={cn(
                    fieldClass,
                    "w-full appearance-none border pr-9 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive",
                    roleId ? "text-foreground" : "text-placeholder",
                  )}
                  id="roleId"
                  name="roleId"
                  onChange={(event) => chooseRole(event.target.value)}
                  value={roleId}
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option className="text-foreground" key={role.id} value={role.id}>
                      {uiLabel(role.name)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-on-surface-variant"
                />
              </div>
            </Field>
          </div>
          <p className="flex items-center gap-2.5 rounded-lg bg-callout px-3 py-2.5 text-[13px] text-callout-foreground">
            <Info aria-hidden="true" className="size-4 shrink-0 text-identity" />
            A temporary password is generated and emailed; you will not see it.
          </p>
        </section>

        <section aria-labelledby="module-access-heading" className={panelClass}>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold text-foreground" id="module-access-heading">
              System access
            </h2>
            <p className="text-xs text-on-surface-variant">
              Choosing a role ticks its usual modules. Change any box before creating the user.
            </p>
          </div>
          <FieldError id="moduleIds-error" message={fieldErrors.moduleIds} />
          <ModuleAccessMatrix setSelected={setModuleIds} selected={moduleIds} systems={systems} />
          <p aria-live="polite" className="text-[13px] font-medium text-identity">
            {plural(selection.modules, "module")} selected across {plural(selection.systems, "system")}
            {request ? (matchesRequest ? " · matches the request" : " · differs from the request") : ""}
          </p>
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-surface px-6 py-3.5 leading-[normal] md:px-8">
        <p className="min-w-0 flex-1 text-[13px] text-on-surface-variant">Fields marked * are required.</p>
        <Button asChild size="cta" variant="row-action">
          <Link href={request ? "/admin/account-requests" : "/admin/users"}>Cancel</Link>
        </Button>
        <Button disabled={isPending} size="cta" type="submit" variant="identity">
          {isPending ? "Creating…" : "Create user"}
          {isPending ? <Spinner /> : <ArrowRight aria-hidden="true" />}
        </Button>
      </div>
    </form>
  );
}
