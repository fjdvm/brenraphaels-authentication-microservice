import { Box, Contact, LayoutGrid, Store, Users, type LucideIcon } from "lucide-react";

export type SystemStyle = { icon: LucideIcon; tile: string; accent: string };

// Keys match SeedSystem.iconName; unknown keys fall back to a generic, neutral style.
const SYSTEM_STYLES: Record<string, SystemStyle> = {
  users: { icon: Users, tile: "bg-system-crms", accent: "text-system-crms-foreground" },
  contact: { icon: Contact, tile: "bg-system-hrms", accent: "text-system-hrms-foreground" },
  package: { icon: Box, tile: "bg-system-ims", accent: "text-system-ims-foreground" },
  store: { icon: Store, tile: "bg-system-pos", accent: "text-system-pos-foreground" },
};

const FALLBACK_STYLE: SystemStyle = { icon: LayoutGrid, tile: "bg-badge-muted", accent: "text-foreground" };

/** Figma's per-System icon tile colours, shared by the Access cards and the Module access cards. */
export function systemStyle(iconName: string | null | undefined): SystemStyle {
  return (iconName && SYSTEM_STYLES[iconName]) || FALLBACK_STYLE;
}
