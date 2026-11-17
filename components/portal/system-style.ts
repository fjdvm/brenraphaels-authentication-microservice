import { Box, Contact, LayoutGrid, Store, Users, type LucideIcon } from "lucide-react";

import type { FigmaIconName } from "@/components/ui/figma-icon";

type SystemStyle = {
  icon: LucideIcon;
  /** The Figma icon of Systems the Member frames show (CREOMS, IMS); others use the Lucide icon. */
  figmaIcon?: FigmaIconName;
  tile: string;
  accent: string;
};

// Keys match SeedSystem.iconName; unknown keys fall back to a generic, neutral style.
const SYSTEM_STYLES: Record<string, SystemStyle> = {
  users: { icon: Users, figmaIcon: "user-26", tile: "bg-system-crms", accent: "text-system-crms-foreground" },
  contact: { icon: Contact, tile: "bg-system-hrms", accent: "text-system-hrms-foreground" },
  package: { icon: Box, figmaIcon: "box-26", tile: "bg-system-ims", accent: "text-system-ims-foreground" },
  store: { icon: Store, tile: "bg-system-pos", accent: "text-system-pos-foreground" },
};

const FALLBACK_STYLE: SystemStyle = { icon: LayoutGrid, tile: "bg-badge-muted", accent: "text-foreground" };

/** Figma's per-System icon, icon tile and accent colour. */
export function systemStyle(iconName: string | null): SystemStyle {
  return (iconName && SYSTEM_STYLES[iconName]) || FALLBACK_STYLE;
}

export const pluralModules = (count: number) => `module${count === 1 ? "" : "s"}`;
