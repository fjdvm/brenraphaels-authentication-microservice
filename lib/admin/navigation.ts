import { LayoutGrid, ScrollText, Users, type LucideIcon } from "lucide-react";

export type AdministrativeDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAVIGATION: readonly AdministrativeDestination[] = [
  { href: "/admin/access", label: "Access", icon: LayoutGrid },
  { href: "/admin/users", label: "User management", icon: Users },
  { href: "/admin/system-logs", label: "System logs", icon: ScrollText },
];
