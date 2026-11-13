import { ArrowRight, Check, Info } from "lucide-react";
import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/submit-button";

import { AuthHeading } from "./auth-card";

// Figma "Portal · Email verified". Presentational: the Portal has no email-link sign-in step yet.
type EmailVerifiedScreenProps = {
  account: string;
  device: string;
  location: string;
  continueHref?: string;
};

export function EmailVerifiedScreen({
  account,
  device,
  location,
  continueHref = "/",
}: EmailVerifiedScreenProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-success-soft">
        <Check aria-hidden="true" className="size-[22px] text-success" />
      </div>
      <AuthHeading
        title="You're signed in"
        description="Your email link was confirmed. Taking you to the portal…"
      />
      <dl className="flex flex-col gap-2 rounded-[10px] border border-[#ede9f2] bg-[#fafafa] p-3.5 text-[13px]/[normal]">
        {(
          [
            ["Account", account],
            ["Device", device],
            ["Location", location],
          ] as const
        ).map(([term, value]) => (
          <div className="flex items-start gap-4" key={term}>
            <dt className="flex-1 text-on-surface-variant">{term}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <Link className={primaryButtonClass} href={continueHref}>
        Continue to portal
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <div className="flex items-start gap-2">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-on-surface-variant" />
        <p className="flex-1 text-xs/[normal] text-on-surface-variant">
          Not you? Change your password and tell your administrator.
        </p>
      </div>
    </div>
  );
}
