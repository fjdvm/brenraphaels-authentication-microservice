"use client";

import Link from "next/link";
import { useActionState } from "react";

import { forgotPasswordAction, type FormState } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";

import {
  AuthCardHeader,
  AuthHeading,
  FormAlert,
  authCardClass,
  authInputClass,
} from "./auth-card";

const initialState: FormState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className={authCardClass}>
      <AuthCardHeader />
      <div className="space-y-5">
        <AuthHeading
          title="Forgot your password?"
          description="Enter the email your credentials were sent to and we'll email you a reset link."
        />
        <label className="flex flex-col gap-2 text-sm font-semibold" htmlFor="email">
          Email
          <input
            autoComplete="email"
            className={authInputClass}
            id="email"
            name="email"
            placeholder="you@company.com"
            required
            type="email"
          />
        </label>
        {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
        {state.message ? <FormAlert tone="success">{state.message}</FormAlert> : null}
        <SubmitButton label="Send reset link" pendingLabel="Sending…" />
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
