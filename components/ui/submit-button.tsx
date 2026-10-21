"use client";

import { ArrowRight } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Spinner } from "./spinner";

/** Figma primary button; also used for links styled as the primary action. */
export const primaryButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-identity py-3 text-sm/[normal] font-semibold text-identity-foreground transition-colors hover:bg-identity/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-identity/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
};

// `useFormStatus` reports the form action as pending immediately. State set
// inside a form action (e.g. `setIsPending(true)`) is batched into the action's
// transition and isn't committed until the action finishes, so it can't drive
// a loading indicator.
export function SubmitButton({ label, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={primaryButtonClass}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
      {pending ? <Spinner /> : <ArrowRight aria-hidden="true" className="size-4" />}
    </button>
  );
}
