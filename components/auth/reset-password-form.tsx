"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction, type FormState } from "@/actions/auth";
import { SubmitButton, primaryButtonClass } from "@/components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

import {
  AuthHeading,
  FormAlert,
  authFieldsClass,
  authFormClass,
  authLinkClass,
} from "./auth-card";
import { PasswordInput } from "./password-input";

const initialState: FormState = { error: null };

type ResetPasswordFormProps = {
  token: string;
  email?: string;
  signature?: string;
};

// Figma has no frame for the reset link's destination; it follows Forgot password.
export function ResetPasswordForm({ token, email, signature }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className={authFormClass}>
      <AuthHeading
        title="Set a new password"
        description="Choose a new password for your Username."
      />
      <input name="token" type="hidden" value={token} />
      {email ? <input name="e" type="hidden" value={email} /> : null}
      {signature ? <input name="s" type="hidden" value={signature} /> : null}
      <div className={authFieldsClass}>
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
        <SubmitButton label="Reset password" pendingLabel="Saving…" />
      </div>
      <BackToLogIn />
    </form>
  );
}

export function InvalidResetLink() {
  return (
    <div className={authFormClass}>
      <AuthHeading
        title="Reset link not valid"
        description="This link is missing or has expired. Reset links last 15 minutes."
      />
      <Link className={primaryButtonClass} href="/forgot-password">
        Request a new link
      </Link>
      <BackToLogIn />
    </div>
  );
}

function BackToLogIn() {
  return (
    <Link className={authLinkClass} href="/login">
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      Back to log in
    </Link>
  );
}
