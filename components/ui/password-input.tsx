"use client";

import { useState } from "react";

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

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low pl-3 pr-12 text-base font-normal outline-none transition-colors focus:border-primary"
          id={id}
          minLength={minLength}
          name={name}
          placeholder="••••••••"
          required
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-on-surface-variant transition-colors hover:text-primary focus-visible:text-primary"
          onClick={() => setIsVisible((visible) => !visible)}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            {isVisible ? (
              <>
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <path d="m2 2 20 20" />
              </>
            ) : (
              <>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
