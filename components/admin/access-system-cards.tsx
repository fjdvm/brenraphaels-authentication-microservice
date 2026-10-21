import { ArrowUpRight, LayoutGrid } from "lucide-react";

import { pluralModules, systemStyle } from "@/components/portal/system-style";
import { Badge } from "@/components/ui/badge";
import type { AccessibleSystem } from "@/lib/portal/accessible-systems";

/**
 * Figma "Portal · Access": one card per Accessible System. A card only opens the
 * System's configured destination; the System still decides Module access itself.
 */
export function AccessSystemCards({ systems }: { systems: AccessibleSystem[] }) {
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
    <ul className="grid gap-4 md:grid-cols-2">
      {systems.map((system) => {
        const style = systemStyle(system.iconName);
        const Icon = style.icon;

        return (
          <li key={system.id}>
            <a
              className="group flex h-full flex-col gap-4 rounded-xl border border-panel-border bg-surface px-6 pt-6 pb-5.5 leading-[normal] outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
              href={system.url}
            >
              <span className="flex h-25 items-center justify-between">
                <span className={`flex size-12 items-center justify-center rounded-xl ${style.tile}`}>
                  <Icon aria-hidden="true" className={`size-6 ${style.accent}`} strokeWidth={1.75} />
                </span>
                <Badge variant="muted">
                  {system.grantedModules} of {system.totalModules} {pluralModules(system.totalModules)}
                </Badge>
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="text-xl font-bold text-foreground">{system.name}</span>
                {system.description ? (
                  <span className="text-sm text-on-surface-variant">{system.description}</span>
                ) : null}
              </span>
              <span aria-hidden="true" className="h-px w-full bg-table-divider" />
              <span className={`mt-auto flex items-center gap-1.5 text-sm font-semibold ${style.accent}`}>
                Open {system.name}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
