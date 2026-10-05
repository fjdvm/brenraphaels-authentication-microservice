import type { ReactNode } from "react";

import { BrandLogo } from "@/components/ui/brand-logo";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,transparent_0,transparent_calc(100%-1px),var(--outline-variant)_80%),linear-gradient(to_bottom,transparent_0,transparent_calc(100%-1px),var(--outline-variant)_80%)] bg-size-[40px_40px] [mask-image:radial-gradient(ellipse_at_center,transparent_35%,black_80%)]" />
      {children}
    </main>
  );
}

export function AuthCardHeader() {
  return (
    <header className="mb-8 flex flex-col items-center text-center">
      <BrandLogo className="mb-4 rounded-2xl" size={72} />
      <p className="text-2xl font-semibold tracking-tight text-primary">
        Bren Raphael&apos;s
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">Enterprise Suite</p>
    </header>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
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
          ? "rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
          : "rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary"
      }
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export const authCardClass =
  "w-full max-w-md rounded-xl border border-outline-variant bg-surface p-6 shadow-sm sm:p-10";

export const authInputClass =
  "h-12 rounded-lg border border-outline-variant bg-surface-container-low px-3 text-base font-normal outline-none transition-colors focus:border-primary";

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
