"use client";

import { useActionState } from "react";

import { changePasswordAction, type FormState } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

import {
  AuthHeading,
  FormAlert,
  ReturnRequestFields,
  type ReturnRequestProps,
  authFieldsClass,
  authFormClass,
} from "./auth-card";
import { PasswordInput } from "./password-input";

const initialState: FormState = { error: null };

// Figma has no Change password frame; it follows the Log in frame.
export function ChangePasswordForm(returnRequest: ReturnRequestProps) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className={authFormClass}>
      <AuthHeading
        title="Change your password"
        description="Enter the temporary password you were emailed, then choose a new one before continuing."
      />
      <ReturnRequestFields {...returnRequest} />
      <div className={authFieldsClass}>
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
        {state.error && !isPending ? <FormAlert tone="error">{state.error}</FormAlert> : null}
        <SubmitButton label="Change password" pendingLabel="Saving…" />
      </div>
    </form>
  );
}
