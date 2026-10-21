import { FileClock, LayoutGrid, type LucideIcon, ScrollText, UserRound } from "lucide-react";

export type AdministrativeDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Administrator-only destinations; never shown to other Users. */
export const ADMIN_NAVIGATION: readonly AdministrativeDestination[] = [
  { href: "/admin/access", label: "Access", icon: LayoutGrid },
  { href: "/admin/users", label: "User management", icon: UserRound },
  { href: "/admin/system-logs", label: "System logs", icon: FileClock },
];

/** Every User's own My Logs. Not in Figma; a reviewed addition from Spec#51. */
export const MY_LOGS_DESTINATION: AdministrativeDestination = {
  href: "/my-logs",
  label: "My logs",
  icon: ScrollText,
};

export type SidebarSection = {
  /** Heading shown above the section; unlabelled sections have none. */
  label?: string;
  destinations: readonly AdministrativeDestination[];
};

/** The sidebar, in order: Access, then the "ADMIN" section ending with My logs. */
export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  { destinations: ADMIN_NAVIGATION.slice(0, 1) },
  {
    label: "ADMIN",
    destinations: [...ADMIN_NAVIGATION.slice(1), MY_LOGS_DESTINATION],
  },
];

/** Every sidebar destination, flattened in display order. */
export const SIDEBAR_NAVIGATION: readonly AdministrativeDestination[] = SIDEBAR_SECTIONS.flatMap(
  ({ destinations }) => destinations,
);
