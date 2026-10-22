"use client";

import { ArrowUpRight, Contact, LayoutGrid, Loader2, Package, Store, Users, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import type { AccessibleSystem } from "@/lib/portal/accessible-systems";
import { cn } from "@/lib/utils/cn";

// Keys match SeedSystem.iconName; unknown keys fall back to a generic icon.
const SYSTEM_ICONS: Record<string, LucideIcon> = {
  users: Users,
  contact: Contact,
  store: Store,
  package: Package,
};

const MIN_LOADING_MS = 800;
const MAX_LOADING_MS = 15_000;

function startStopwatch() {
  const startedAt = Date.now();
  return () => Date.now() - startedAt;
}

/**
 * One launch card per Accessible System. A card only opens the System's configured
 * destination; the System still decides Module access from the User's AccessGrants.
 */
export function SystemLaunchCards({ systems }: { systems: AccessibleSystem[] }) {
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // The System opens in a new tab, so its real load cannot be observed from here (cross-origin).
  // A no-cors request to the same URL settles when the System starts responding, which is the
  // closest signal; the cap keeps the card from spinning forever if the System never answers.
  function launch(system: AccessibleSystem) {
    const elapsed = startStopwatch();
    const controller = new AbortController();
    setLaunchingId(system.id);

    const finish = () => {
      controller.abort();
      const wait = Math.max(0, MIN_LOADING_MS - elapsed());
      timers.current.push(setTimeout(() => setLaunchingId((id) => (id === system.id ? null : id)), wait));
    };

    timers.current.push(setTimeout(finish, MAX_LOADING_MS));
    fetch(system.url, { mode: "no-cors", signal: controller.signal }).then(finish, finish);
  }

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
    <ul className={cn("grid gap-6", systems.length > 1 && "sm:grid-cols-2")}>
      {systems.map((system) => {
        const Icon = (system.iconName && SYSTEM_ICONS[system.iconName]) || LayoutGrid;
        const isLaunching = launchingId === system.id;

        return (
          <li key={system.id}>
            <a
              className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={system.url}
              onClick={() => launch(system)}
              rel="noopener"
              target="_blank"
            >
              <Card className="flex h-full min-h-56 flex-col justify-between gap-6 p-8 transition-colors group-hover:border-primary group-hover:shadow-md">
                <div className="flex flex-col gap-4">
                  <Icon aria-hidden="true" className="size-9 text-primary" strokeWidth={1.5} />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground">{system.name}</h3>
                    {system.description ? (
                      <p className="text-base text-on-surface-variant">{system.description}</p>
                    ) : null}
                  </div>
                </div>
                <span aria-live="polite" className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  {isLaunching ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      Opening {system.name}…
                    </>
                  ) : (
                    <>
                      Open
                      <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </>
                  )}
                </span>
              </Card>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
