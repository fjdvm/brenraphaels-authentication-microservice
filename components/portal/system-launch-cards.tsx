import { ArrowUpRight, Contact, LayoutGrid, Package, Store, Users, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccessibleSystem } from "@/lib/portal/accessible-systems";
import { cn } from "@/lib/utils/cn";

// Keys match SeedSystem.iconName; unknown keys fall back to a generic icon.
const SYSTEM_ICONS: Record<string, LucideIcon> = {
  users: Users,
  contact: Contact,
  store: Store,
  package: Package,
};

function destinationHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * One launch card per Accessible System. A card only opens the System's configured
 * destination; the System still decides Module access from the User's AccessGrants.
 */
export function SystemLaunchCards({ systems }: { systems: AccessibleSystem[] }) {
  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <LayoutGrid aria-hidden="true" className="size-8 text-on-surface-variant" />
        <h2 className="text-lg font-semibold text-primary">No Systems available yet</h2>
        <p className="max-w-sm text-sm text-on-surface-variant">
          You don&apos;t have access to any Systems. An Administrator needs to grant you access before you can launch one.
        </p>
      </div>
    );
  }

  return (
    <ul className={cn("grid gap-4", systems.length > 1 && "sm:grid-cols-2")}>
      {systems.map((system) => {
        const Icon = (system.iconName && SYSTEM_ICONS[system.iconName]) || LayoutGrid;

        return (
          <li key={system.id}>
            <a
              className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={system.url}
            >
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Icon aria-hidden="true" className="size-6 text-primary" />
                    <ArrowUpRight aria-hidden="true" className="size-4 text-on-surface-variant" />
                  </div>
                  <CardTitle className="pt-2 text-lg">{system.name}</CardTitle>
                  {system.description ? <CardDescription>{system.description}</CardDescription> : null}
                </CardHeader>
                <CardContent>
                  <p className="truncate font-mono text-xs text-on-surface-variant">
                    {destinationHost(system.url)}
                  </p>
                </CardContent>
              </Card>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
