import { LayoutGrid } from "lucide-react";

import { OpenSystemLink } from "@/components/portal/open-system-link";
import { pluralModules, systemStyle } from "@/components/portal/system-style";
import { Badge } from "@/components/ui/badge";
import type { AccessibleSystem } from "@/lib/portal/accessible-systems";
import { cn } from "@/lib/utils/cn";

/**
 * Figma "Staff home": one card per Accessible System, naming the Modules the User holds. A card
 * only opens the System's configured destination; the System still decides Module access from
 * the User's AccessGrants.
 */
export function SystemLaunchCards({ systems }: { systems: AccessibleSystem[] }) {
  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-panel-border bg-surface p-10 text-center">
        <LayoutGrid aria-hidden="true" className="size-8 text-on-surface-variant" />
        <h2 className="text-lg font-semibold text-foreground">No Systems available yet</h2>
        <p className="max-w-sm text-sm text-on-surface-variant">
          You don&apos;t have access to any Systems. An Administrator needs to grant you access before you can launch one.
        </p>
      </div>
    );
  }

  return (
    <ul className={cn("grid gap-5", systems.length > 1 && "xl:grid-cols-2")}>
      {systems.map((system) => {
        const style = systemStyle(system.iconName);
        const Icon = style.icon;

        return (
          <li
            className="flex flex-col items-start gap-[18px] rounded-xl border border-panel-border bg-surface px-7 pt-7 pb-6.5 leading-[normal]"
            key={system.id}
          >
            <div className="flex h-25 w-full items-center justify-between">
              <span className={cn("flex size-14 items-center justify-center rounded-[14px]", style.tile)}>
                <Icon aria-hidden="true" className={cn("size-7", style.accent)} strokeWidth={1.75} />
              </span>
              <Badge variant="muted">
                {system.grantedModules} of {system.totalModules} {pluralModules(system.totalModules)}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl font-bold text-foreground">{system.name}</h2>
              {system.description ? <p className="text-[15px] text-on-surface-variant">{system.description}</p> : null}
            </div>
            <ul aria-label={`${system.name} modules`} className="flex flex-wrap gap-2">
              {system.grantedModuleNames.map((moduleName) => (
                <li
                  className="rounded-md border border-chip-border bg-chip px-2.5 py-1 text-xs font-medium text-badge-muted-foreground"
                  key={moduleName}
                >
                  {moduleName}
                </li>
              ))}
            </ul>
            <OpenSystemLink name={system.name} url={system.url} />
          </li>
        );
      })}
    </ul>
  );
}
