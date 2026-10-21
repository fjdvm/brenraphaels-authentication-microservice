import { FileText, LayoutGrid, type LucideIcon, ScrollText, UserRound } from "lucide-react";

export type AdministrativeDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Administrator-only destinations; never shown to other Users. */
export const ADMIN_NAVIGATION: readonly AdministrativeDestination[] = [
  { href: "/admin/access", label: "Access", icon: LayoutGrid },
  { href: "/admin/users", label: "User management", icon: UserRound },
  { href: "/admin/system-logs", label: "System logs", icon: FileText },
];

/** Every User's own My Logs. Not in Figma; a reviewed addition from Spec#51. */
export const MY_LOGS_DESTINATION: AdministrativeDestination = {
  href: "/my-logs",
  label: "My logs",
  icon: ScrollText,
};

/** The sidebar, in order: the administrative destinations, then My logs. */
export const SIDEBAR_NAVIGATION: readonly AdministrativeDestination[] = [
  ...ADMIN_NAVIGATION,
  MY_LOGS_DESTINATION,
];
