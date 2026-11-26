import { LayoutGrid } from "lucide-react";

import { OpenSystemLink } from "@/components/portal/open-system-link";
import { pluralModules, systemStyle } from "@/components/portal/system-style";
import { Badge } from "@/components/ui/badge";
import { FigmaIcon } from "@/components/ui/figma-icon";
import type { AccessibleSystem } from "@/lib/portal/accessible-systems";
import { cn } from "@/lib/utils/cn";
import { uiLabel } from "@/lib/utils/ui-label";

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
    <ul className={cn("grid auto-rows-fr gap-5", systems.length > 1 && "xl:grid-cols-2")}>
      {systems.map((system) => {
        const style = systemStyle(system.iconName);
        const Icon = style.icon;

        return (
          <li
            className="flex h-full min-h-90 flex-col items-start gap-4 rounded-xl border border-panel-border bg-surface p-7 leading-[normal]"
            key={system.id}
          >
            <div className="flex w-full items-center justify-between">
              <span className={cn("flex items-start rounded-xl p-3.5", style.tile)}>
                {style.figmaIcon ? (
                  <FigmaIcon name={style.figmaIcon} />
                ) : (
                  <Icon aria-hidden="true" className={cn("size-[26px]", style.accent)} strokeWidth={1.75} />
                )}
              </span>
              <Badge className="bg-[#f1f1f3] text-[#52525b]" variant="muted">
                {system.grantedModules} of {system.totalModules} {pluralModules(system.totalModules)}
              </Badge>
            </div>
            <div className="flex w-full flex-col gap-1 pt-5">
              <h2 className="text-2xl font-semibold text-foreground">{uiLabel(system.name)}</h2>
              {system.description ? <p className="line-clamp-2 text-[15px] text-on-surface-variant" title={system.description}>{system.description}</p> : null}
            </div>
            <ul aria-label={`${uiLabel(system.name)} modules`} className="flex w-full flex-wrap gap-2">
              {system.grantedModuleNames.map((moduleName) => (
                <li
                  className="rounded-md border border-input bg-surface px-2.5 py-[5px] text-[13px] font-medium text-[#3f3f46]"
                  key={moduleName}
                >
                  {moduleName}
                </li>
              ))}
            </ul>
            {/* Pinned to the bottom so every card, whatever its Modules, lines up at the same size. */}
            <div className="mt-auto">
              <OpenSystemLink name={uiLabel(system.name)} url={system.url} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
