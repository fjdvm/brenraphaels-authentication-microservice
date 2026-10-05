"use client";

import { useActionState } from "react";

import { changePasswordAction, type FormState } from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

import {
  AuthCardHeader,
  AuthHeading,
  FormAlert,
  ReturnRequestNotice,
  authCardClass,
} from "./auth-card";

const initialState: FormState = { error: null };

export function ChangePasswordForm({
  returnIntent = null,
  systemName = null,
  requestProblem = null,
}: {
  returnIntent?: string | null;
  systemName?: string | null;
  requestProblem?: "expired" | "invalid" | null;
}) {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className={authCardClass}>
      <AuthCardHeader />
      <div className="space-y-5">
        {returnIntent ? <input name="ri" type="hidden" value={returnIntent} /> : null}
        <ReturnRequestNotice problem={requestProblem} systemName={systemName} />
        <AuthHeading
          title="Change your password"
          description="Enter the temporary password you were emailed, then choose a new one before continuing."
        />
        <PasswordInput
          autoComplete="current-password"
          id="currentPassword"
          label="Temporary password"
          name="currentPassword"
        />
        <PasswordInput
          autoComplete="new-password"
          id="password"
          label="New password"
          minLength={MIN_PASSWORD_LENGTH}
          name="password"
        />
        <PasswordInput
          autoComplete="new-password"
          id="confirmation"
          label="Confirm new password"
          minLength={MIN_PASSWORD_LENGTH}
          name="confirmation"
        />
        {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
        <SubmitButton label="Change password" pendingLabel="Saving…" />
      </div>
    </form>
  );
}
