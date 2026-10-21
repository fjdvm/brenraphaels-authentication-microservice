"use client";

import { Mail } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ResendOutcome } from "@/lib/admin/user-form-state";

type ResendCredentialsButtonProps = {
  username: string;
  action: () => Promise<ResendOutcome>;
};

export function ResendCredentialsButton({ username, action }: ResendCredentialsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [outcome, setResendOutcome] = useState<ResendOutcome | null>(null);

  function resend() {
    if (!window.confirm(`Issue a new Temporary password to ${username}? Their current password will stop working.`)) {
      return;
    }

    setResendOutcome(null);
    startTransition(async () => {
      try {
        setResendOutcome(await action());
      } catch {
        setResendOutcome({ status: "error", message: "Credentials could not be sent. Try again shortly." });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
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
      {outcome ? (
        <p
          className={`max-w-64 text-xs ${outcome.status === "success" ? "text-primary" : "text-danger"}`}
          role={outcome.status === "success" ? "status" : "alert"}
        >
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}
