"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { updatePasswordAction } from "@/actions/account";
import type { FormState } from "@/actions/auth";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { PASSWORD_REQUIREMENTS } from "@/lib/portal/password-requirements";
import { cn } from "@/lib/utils/cn";
import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

/** `saves` counts saved passwords; each one starts the form again with empty fields. */
type State = FormState & { saves: number };

const initialState: State = { error: null, saves: 0 };

// Figma "field/…": a 13px label over a 14px input; the focused field takes a 1.5px violet border.
const input =
  "w-full rounded-lg border border-input bg-surface px-3 py-[9px] text-sm leading-[normal] text-foreground outline-none focus:border-[1.5px] focus:border-[#8b5cf6] focus:px-[11.5px] focus:py-[8.5px]";

function Field({ id, label, name, autoComplete, minLength, onChange }: {
  id: string;
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5 leading-[normal]">
      <label className="text-[13px] font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        autoComplete={autoComplete}
        className={input}
        id={id}
        minLength={minLength}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        required
        type="password"
      />
    </div>
  );
}

function UpdateButton({ pending }: { pending: boolean }) {
  return (
    <button
      className="flex items-center justify-center rounded-lg bg-identity px-3.5 py-[9px] text-sm leading-[normal] font-medium text-identity-foreground hover:bg-identity/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

function Fields({ pending }: { pending: boolean }) {
  const [password, setPassword] = useState("");

  return (
    <>
      <Field autoComplete="current-password" id="currentPassword" label="Current password" name="currentPassword" />
      <Field
        autoComplete="new-password"
        id="password"
        label="New password"
        minLength={MIN_PASSWORD_LENGTH}
        name="password"
        onChange={setPassword}
      />
      <Field
        autoComplete="new-password"
        id="confirmation"
        label="Confirm new password"
        minLength={MIN_PASSWORD_LENGTH}
        name="confirmation"
      />
      <ul aria-label="Password requirements" className="flex w-full flex-wrap gap-1.5 leading-[normal]">
        {PASSWORD_REQUIREMENTS.map(({ label, isMet }) => {
          const met = isMet(password);

          return (
            <li
              className={cn(
                "flex items-center rounded-full py-[3px] text-xs font-medium",
                met ? "gap-[5px] bg-badge-success pr-2.5 pl-[7px] text-badge-success-foreground" : "bg-[#f1f1f3] px-2.5 text-[#52525b]",
              )}
              data-met={met}
              key={label}
            >
              {met ? <FigmaIcon name="check-12-green" /> : null}
              {label}
            </li>
          );
        })}
      </ul>
      <UpdateButton pending={pending} />
    </>
  );
}

/** Figma "Member · Change password": current, new and confirm, with the four requirement chips. */
export function UpdatePasswordForm() {
  const [state, formAction, isActionPending] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    const result = await updatePasswordAction(previous, formData);
    if (result.error) toast.error(result.error);
    else if (result.message) toast.success(result.message);

    return { ...result, saves: previous.saves + (result.message ? 1 : 0) };
  }, initialState);
  const [isSubmitting, startSubmit] = useTransition();

  // Submitted by hand, not as the form's action: React empties a form after its action runs,
  // even when the server refused, and a refused password change must keep what was typed.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSubmit(() => formAction(formData));
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-[520px] flex-col items-start gap-3.5 rounded-xl border border-panel-border bg-surface p-6"
      // A saved password clears the fields: the new form instance starts empty.
      key={state.saves}
    >
      <Fields pending={isActionPending || isSubmitting} />
    </form>
  );
}
