import type { ReactNode } from "react";

import { BrandLogo } from "@/components/ui/brand-logo";
import { PortalActions } from "@/components/layout/portal-actions";

type PortalShellProps = {
  children: ReactNode;
  firstName?: string | null;
};

export function PortalShell({ children, firstName }: PortalShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-container-low">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <BrandLogo className="rounded-lg" size={40} />
            <div>
              <p className="text-lg font-semibold tracking-tight text-primary">
                Bren Raphael&apos;s
              </p>
              <p className="text-xs text-on-surface-variant">Enterprise Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {firstName ? (
              <p className="hidden text-sm text-on-surface-variant sm:block">
                {firstName}
              </p>
            ) : null}
            <PortalActions />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
