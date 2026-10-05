"use client";

import { MailCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Outcome = { status: "success" | "error"; message: string };

type ResendCredentialsButtonProps = {
  username: string;
  action: () => Promise<Outcome>;
};

export function ResendCredentialsButton({ username, action }: ResendCredentialsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function resend() {
    if (!window.confirm(`Issue a new Temporary password to ${username}? Their current password will stop working.`)) {
      return;
    }

    setOutcome(null);
    startTransition(async () => {
      try {
        setOutcome(await action());
      } catch {
        setOutcome({ status: "error", message: "Credentials could not be sent. Try again shortly." });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button disabled={isPending} onClick={resend} size="sm" type="button" variant="outline">
        {isPending ? <Spinner /> : <MailCheck aria-hidden="true" />}
        Resend credentials
        <span className="sr-only"> to {username}</span>
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
