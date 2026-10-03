"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction, type FormState } from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";

import {
  AuthCardHeader,
  FormAlert,
  authCardClass,
  authInputClass,
} from "./auth-card";

const initialState: FormState = { error: null };

// YYYY-XX-NNN, or the bootstrap Super Admin's YYYY-ADMIN-NNN.
const usernamePattern = /^\d{4}-([A-Za-z]{2}|ADMIN)-\d{3}$/i;

export function LoginForm({ passwordWasReset }: { passwordWasReset: boolean }) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [username, setUsername] = useState("");

  return (
    <form action={formAction} className={authCardClass}>
      <AuthCardHeader />
      <div className="space-y-5">
        {passwordWasReset ? (
          <FormAlert tone="success">
            Your password was updated. Log in with your new password.
          </FormAlert>
        ) : null}
        <label className="flex flex-col gap-2 text-sm font-semibold" htmlFor="username">
          Username
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
        </label>
        {username && !usernamePattern.test(username.trim()) ? (
          <p className="text-sm text-on-surface-variant">Expected format: YYYY-XX-NNN</p>
        ) : null}
        <PasswordInput
          autoComplete="current-password"
          id="password"
          label="Password"
          name="password"
        />
        {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
        <SubmitButton label="Log in" pendingLabel="Logging in…" />
        <p className="text-center text-sm">
          <Link
            className="text-on-surface-variant underline-offset-4 hover:text-primary hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </form>
  );
}
