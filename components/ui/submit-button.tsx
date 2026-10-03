"use client";

import { useFormStatus } from "react-dom";

import { Spinner } from "./spinner";

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
      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}{" "}
      {pending ? <Spinner /> : <span aria-hidden="true">→</span>}
    </button>
  );
}
