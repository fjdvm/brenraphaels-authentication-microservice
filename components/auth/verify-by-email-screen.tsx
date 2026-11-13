import { ArrowLeft, ExternalLink, Info, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Spinner } from "@/components/ui/spinner";

import { AuthHeading, authLinkClass } from "./auth-card";

// Figma "Portal · Verify by email". The Portal has no email-link sign-in step yet,
// so this screen is presentational and nothing routes to it.
type VerifyByEmailScreenProps = {
  /** The address, already masked (e.g. j•••••••08@gmail.com). */
  maskedEmail: string;
  /** Mailbox the "Open …" button points at. */
  mailboxName: string;
  mailboxHref: string;
  /** Countdown text shown in the hint, e.g. "0:45". */
  resendIn: string;
  onResend?: () => void;
};

export function VerifyByEmailScreen({
  maskedEmail,
  mailboxName,
  mailboxHref,
  resendIn,
  onResend,
}: VerifyByEmailScreenProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-identity-soft">
        <Mail aria-hidden="true" className="size-[22px] text-identity" />
      </div>
      <AuthHeading
        title="Check your email"
        description={`We sent a sign-in link to ${maskedEmail}. Click the link in that email to finish logging in.`}
      />
      <div
        className="flex items-center gap-3 rounded-[10px] border border-[#ede9f2] bg-[#fafafa] p-3.5"
        role="status"
      >
        <Spinner />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm/[normal] font-medium text-foreground">Waiting for you to click the link…</p>
          <p className="text-xs/[normal] text-on-surface-variant">
            This page continues by itself. The link expires in 15 minutes.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <a
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-identity py-3 text-sm/[normal] font-semibold text-identity-foreground transition-colors hover:bg-identity/90"
          href={mailboxHref}
          rel="noreferrer"
          target="_blank"
        >
          Open {mailboxName}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-white py-3 text-sm/[normal] font-semibold text-foreground"
          onClick={onResend}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Resend link
        </button>
      </div>
      <div className="flex items-start gap-2">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-on-surface-variant" />
        <p className="flex-1 text-xs/[normal] text-on-surface-variant">
          Can&apos;t find it? Check your Spam or Promotions folder. You can resend in {resendIn}.
        </p>
      </div>
      <Link className={authLinkClass} href="/login">
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Use a different account
      </Link>
    </div>
  );
}
