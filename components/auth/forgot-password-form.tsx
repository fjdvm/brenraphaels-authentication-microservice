"use client";

import { ArrowRight, AtSign, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { forgotPasswordAction, type FormState } from "@/actions/auth";
import { SubmitButton, primaryButtonClass } from "@/components/ui/submit-button";

import {
  AuthField,
  AuthHeading,
  BackToLogIn,
  FormAlert,
  authFieldsClass,
  authFormClass,
  authInputClass,
} from "./auth-card";

const initialState: FormState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);
  // Kept in state so the sent screen can name the address after the form action resets the form.
  const [email, setEmail] = useState("");

  if (state.message) {
    return <ResetLinkSent email={email} />;
  }

  return (
    <form action={formAction} className={authFormClass}>
      <AuthHeading
        title="Forgot your password?"
        description="Enter the email your credentials were sent to and we'll email you a reset link."
      />
      <div className={authFieldsClass}>
        <AuthField icon={AtSign} id="email" label="Email">
          <input
            autoComplete="email"
            className={authInputClass}
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
            type="email"
            value={email}
          />
        </AuthField>
        {state.error && !isPending ? <FormAlert tone="error">{state.error}</FormAlert> : null}
        <SubmitButton label="Send reset link" pendingLabel="Sending…" />
      </div>
      <BackToLogIn />
    </form>
  );
}

/** Figma "Reset link sent". The reply is the same whether or not a User has that Email. */
function ResetLinkSent({ email }: { email: string }) {
  return (
    <div className={authFormClass}>
      <div className="flex size-12 items-center justify-center rounded-full bg-success-soft">
        <MailCheck aria-hidden="true" className="size-[22px] text-success" />
      </div>
      <AuthHeading
        title="Check your email"
        description={`If ${email.trim()} belongs to a user, a reset link is on its way. The link expires in 15 minutes.`}
      />
      <Link className={primaryButtonClass} href="/login">
        Back to log in
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
