"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

import { AuthField, authInputClass } from "./auth-card";

type PasswordInputProps = {
  id: string;
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
};

export function PasswordInput({
  id,
  label,
  name,
  autoComplete,
  minLength,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ToggleIcon = isVisible ? EyeOff : Eye;

  return (
    <AuthField
      icon={Lock}
      id={id}
      label={label}
      trailing={
        <button
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded text-on-surface-variant transition-colors hover:text-identity focus-visible:text-identity focus-visible:outline-none"
          onClick={() => setIsVisible((visible) => !visible)}
          type="button"
        >
          <ToggleIcon aria-hidden="true" className="size-4" />
        </button>
      }
    >
      <input
        autoComplete={autoComplete}
        className={authInputClass}
        id={id}
        minLength={minLength}
        name={name}
        placeholder="••••••••"
        required
        type={isVisible ? "text" : "password"}
      />
    </AuthField>
  );
}
