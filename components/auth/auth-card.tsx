import { Box, IdCardLanyard, Shield, Store, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/ui/brand-logo";
import { cn } from "@/lib/utils/cn";

// Figma "Brand panel" chips, in the panel's order.
const PANEL_SYSTEMS: { name: string; icon: LucideIcon }[] = [
  { name: "CRMS", icon: Users },
  { name: "HRMS", icon: IdCardLanyard },
  { name: "IMS", icon: Box },
  { name: "POS", icon: Store },
];

/** Figma auth frames: the brand panel beside a centred 400px form column. */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 bg-white">
      <BrandPanel />
      {/* The footnote sits out of flow so the form centres on the full height, as in Figma. */}
      <div className="relative flex min-w-0 flex-1 flex-col items-center px-4 sm:px-6">
        <div className="flex w-full max-w-[400px] flex-1 flex-col justify-center py-16">
          <AuthBrandLockup className="mb-10 lg:hidden" tone="light" />
          {children}
        </div>
        <p className="absolute inset-x-4 bottom-[33px] text-center text-xs/[normal] text-placeholder">
          Trouble logging in? Contact your administrator.
        </p>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden w-[620px] shrink-0 flex-col overflow-hidden bg-auth-panel lg:flex">
      <div aria-hidden="true" className="absolute left-[360px] top-[-160px] size-[520px] rounded-full bg-auth-panel-circle-top" />
      <div aria-hidden="true" className="absolute bottom-[-180px] left-[-200px] size-[520px] rounded-full bg-auth-panel-circle-left" />
      <div aria-hidden="true" className="absolute bottom-[-20px] left-[430px] size-[300px] rounded-full bg-auth-panel-circle-right" />
      <div className="relative flex flex-1 flex-col gap-8 px-16 pb-12 pt-14">
        <AuthBrandLockup tone="dark" />
        <div className="flex-1" />
        <div className="flex flex-col gap-4">
          <p className="text-[38px]/[1.15] font-bold text-white">One login for the whole business.</p>
          <p className="text-base/normal text-auth-panel-body">
            Customers, people, stock and sales: open every system you have access to from one place.
          </p>
          <ul className="flex flex-wrap gap-2.5 pt-3">
            {PANEL_SYSTEMS.map(({ name, icon: Icon }) => (
              <li
                className="flex items-center gap-2 rounded-full border border-white/16 bg-white/8 py-2 pl-3 pr-3.5 text-[13px]/[normal] font-semibold text-white"
                key={name}
              >
                <Icon aria-hidden="true" className="size-4 text-auth-panel-icon" />
                {name}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs/[normal]">
          <Shield aria-hidden="true" className="size-3.5 text-auth-panel-note" />
          <p className="flex-1 text-auth-panel-note">Accounts are created by your administrator.</p>
          <p className="text-auth-panel-copyright">© 2026 · Antipolo, Rizal</p>
        </div>
      </div>
    </aside>
  );
}

/** The panel's logo and name; on narrow screens, where the panel is hidden, it tops the form. */
function AuthBrandLockup({ tone, className }: { tone: "dark" | "light"; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <BrandLogo className="shrink-0 rounded-xl bg-black" size={52} />
      <div className="flex flex-col gap-0.5 leading-[normal]">
        <p className={cn("text-xl font-bold", tone === "dark" ? "text-white" : "text-foreground")}>
          Bren Raphael&apos;s
        </p>
        <p
          className={cn(
            "text-[13px] font-medium",
            tone === "dark" ? "text-auth-panel-subtitle" : "text-on-surface-variant",
          )}
        >
          Enterprise Suite
        </p>
      </div>
    </div>
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
