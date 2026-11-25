"use client";

import { Mail } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ResendOutcome } from "@/lib/admin/user-form-state";

type ResendCredentialsButtonProps = {
  username: string;
  action: () => Promise<ResendOutcome>;
};

export function ResendCredentialsButton({ username, action }: ResendCredentialsButtonProps) {
  const [isPending, startTransition] = useTransition();

  function resend() {
    if (!window.confirm(`Issue a new Temporary password to ${username}? Their current password will stop working.`)) {
      return;
    }

    startTransition(async () => {
      let outcome: ResendOutcome;
      try {
        outcome = await action();
      } catch {
        outcome = { status: "error", message: "Credentials could not be sent. Try again shortly." };
      }
      if (outcome.status === "success") toast.success(outcome.message);
      else toast.error(outcome.message);
    });
  }

  return (
    <Button
        aria-label={`Resend credentials to ${username}`}
        disabled={isPending}
        onClick={resend}
        size="row"
        type="button"
        variant="row-action"
      >
        {isPending ? <Spinner /> : <Mail aria-hidden="true" />}
        Resend
      </Button>
  );
}
