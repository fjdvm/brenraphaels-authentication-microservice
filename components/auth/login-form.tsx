"use client";

import { IdCard } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type FormState } from "@/actions/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingCard } from "@/components/ui/loading-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils/cn";

import {
  AuthField,
  AuthHeading,
  FormAlert,
  ReturnRequestFields,
  type ReturnRequestProps,
  authFieldsClass,
  authFormClass,
  authInputClass,
  authLinkClass,
} from "./auth-card";
import { PasswordInput } from "./password-input";

const initialState: FormState = { error: null };

// YYYY-XX-NNN, or the bootstrap Super Admin's YYYY-ADMIN-NNN.
const usernamePattern = /^\d{4}-([A-Za-z]{2}|ADMIN)-\d{3}$/i;

export function LoginForm({
  passwordWasReset,
  ...returnRequest
}: { passwordWasReset: boolean } & ReturnRequestProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [username, setUsername] = useState("");

  return (
    <form action={formAction} className={authFormClass}>
      <AuthHeading
        title="Welcome back"
        description="Log in with the username from your welcome email."
      />
      <ReturnRequestFields {...returnRequest} />
      {passwordWasReset ? (
        <FormAlert tone="success">
          Your password was updated. Log in with your new password.
        </FormAlert>
      ) : null}
      <div className={authFieldsClass}>
        <AuthField icon={IdCard} id="username" label="Username">
          <input
            autoComplete="username"
            className={authInputClass}
            id="username"
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="YYYY-XX-NNN"
            required
            value={username}
          />
        </AuthField>
        {username && !usernamePattern.test(username.trim()) ? (
          <p className="-mt-2 text-xs text-on-surface-variant">Expected format: YYYY-XX-NNN</p>
        ) : null}
        <PasswordInput
          autoComplete="current-password"
          id="password"
          label="Password"
          name="password"
        />
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[13px]/[normal] text-field-hint">
            <Checkbox defaultChecked name="remember" />
            Remember this device for 30 days
          </label>
          <Link className={cn(authLinkClass, "shrink-0 self-auto")} href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        {state.error && !isPending ? <FormAlert tone="error">{state.error}</FormAlert> : null}
        <SubmitButton label="Log in" pendingLabel="Logging in…" />
      </div>
      <SigningInCard />
    </form>
  );
}

/** Figma "Loading (signing in)": shown while the credentials are being checked. */
function SigningInCard() {
  const { pending } = useFormStatus();

  return pending ? (
    <LoadingCard title="Signing you in…" subtitle="Checking your access to each system" />
  ) : null;
}
