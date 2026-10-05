import { FileText, LayoutGrid, type LucideIcon, UsersRound } from "lucide-react";

export type AdministrativeDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAVIGATION: readonly AdministrativeDestination[] = [
  { href: "/admin/access", label: "Access", icon: LayoutGrid },
  { href: "/admin/users", label: "User management", icon: UsersRound },
  { href: "/admin/system-logs", label: "System logs", icon: FileText },
];
