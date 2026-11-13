import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";

import { AuthBrandPanel } from "./brand-panel";

/** Figma auth frames: the brand panel beside a centred 400px form column. */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 bg-white">
      <AuthBrandPanel />
      {/* The footnote sits out of flow so the form centres on the full height, as in Figma. */}
      <div className="relative flex min-w-0 flex-1 flex-col items-center px-4 sm:px-6">
        <div className="flex w-full max-w-[400px] flex-1 flex-col justify-center py-16">
          <BrandLockup className="mb-10 lg:hidden" />
          {children}
        </div>
        <p className="absolute inset-x-4 bottom-[33px] text-center text-xs/[normal] text-placeholder">
          Trouble logging in? Contact your administrator.
        </p>
      </div>
    </main>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 leading-[normal]">
      <h1 className="text-[26px] font-bold text-foreground">{title}</h1>
      <p className="text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      className={
        tone === "error"
          ? "rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger"
          : "rounded-lg bg-identity/10 px-3 py-2 text-[13px] text-identity"
      }
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

/** Figma form column: heading, then fields, then the links below. */
export const authFormClass = "flex w-full flex-col gap-6";

/** Figma field stack: 16px between fields and the submit button. */
export const authFieldsClass = "flex flex-col gap-4";

export const authLinkClass =
  "inline-flex items-center gap-1.5 self-start text-[13px]/[normal] font-medium text-identity underline-offset-4 hover:underline";

export function BackToLogIn() {
  return (
    <Link className={authLinkClass} href="/login">
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      Back to log in
    </Link>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  /** Content after the input, inside the box (e.g. the show-password toggle). */
  trailing?: ReactNode;
};

/** Figma input: a 13px label over a bordered box holding a leading icon and the input. */
export function AuthField({ id, label, icon: Icon, children, trailing }: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px]/[normal] font-medium text-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-lg border border-input bg-white px-3 transition-colors focus-within:border-identity focus-within:ring-2 focus-within:ring-identity/15">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-placeholder" />
        {children}
        {trailing}
      </div>
    </div>
  );
}

export const authInputClass =
  "min-w-0 flex-1 bg-transparent py-3 text-sm/[normal] text-foreground outline-none placeholder:text-placeholder";

export type ReturnRequestProblem = "expired" | "invalid";

export type ReturnRequestProps = {
  /** Signed token to carry through the form; null when there is nothing to resume. */
  returnIntent?: string | null;
  systemName?: string | null;
  requestProblem?: ReturnRequestProblem | null;
};

/** Carries a pending System request through a form and tells the User about it. */
export function ReturnRequestFields({
  returnIntent = null,
  systemName = null,
  requestProblem = null,
}: ReturnRequestProps) {
  return (
    <>
      {returnIntent ? <input name="ri" type="hidden" value={returnIntent} /> : null}
      <ReturnRequestNotice problem={requestProblem} systemName={systemName} />
    </>
  );
}

/**
 * The System request a login or password change will resume, or why it can't be
 * resumed. Plain login and password change render nothing here.
 */
export function ReturnRequestNotice({
  systemName,
  problem,
}: {
  systemName: string | null;
  problem: ReturnRequestProblem | null;
}) {
  if (problem) {
    return (
      <FormAlert tone="error">
        {problem === "expired"
          ? "That System sign-in request expired. Return to the System and start again, or continue to the portal."
          : "That System sign-in request isn't valid. Return to the System and start again, or continue to the portal."}
      </FormAlert>
    );
  }

  return systemName ? (
    <FormAlert tone="success">You will continue to {systemName} once you are signed in.</FormAlert>
  ) : null;
}
