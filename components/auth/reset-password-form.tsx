"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction, type FormState } from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

import {
  AuthCardHeader,
  AuthHeading,
  FormAlert,
  authCardClass,
} from "./auth-card";

const initialState: FormState = { error: null };

type ResetPasswordFormProps = {
  token: string;
  email?: string;
  signature?: string;
};

export function ResetPasswordForm({ token, email, signature }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className={authCardClass}>
      <AuthCardHeader />
      <div className="space-y-5">
        <AuthHeading
          title="Set a new password"
          description="Choose a new password for your Username."
        />
        <input name="token" type="hidden" value={token} />
        {email ? <input name="e" type="hidden" value={email} /> : null}
        {signature ? <input name="s" type="hidden" value={signature} /> : null}
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
        <p className="text-center text-sm">
          <Link
            className="text-on-surface-variant underline-offset-4 hover:text-primary hover:underline"
            href="/login"
          >
            Back to log in
          </Link>
        </p>
      </div>
    </form>
  );
}

export function InvalidResetLink() {
  return (
    <div className={authCardClass}>
      <AuthCardHeader />
      <div className="space-y-5">
        <AuthHeading
          title="Reset link not valid"
          description="This link is missing or has expired. Reset links last 15 minutes."
        />
        <FormAlert tone="error">Request a new reset link to continue.</FormAlert>
        <p className="text-center text-sm">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/forgot-password"
          >
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
