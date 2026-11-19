import { createLucideIcon, FileClock, LayoutGrid, type LucideIcon, UserRound, UserRoundPlus } from "lucide-react";

/** A user with a clock; lucide has no such icon, so it is drawn on lucide's 24px grid. */
const UserRoundClock = createLucideIcon("user-round-clock", [
  ["path", { d: "M2 21a8 8 0 0 1 9.5-7.86", key: "body" }],
  ["circle", { cx: "10", cy: "8", r: "5", key: "head" }],
  ["circle", { cx: "17", cy: "17", r: "5", key: "clock" }],
  ["path", { d: "M17 15v2l1.25 1", key: "hands" }],
]);

/** The destination that carries the badge of new requests. */
export const ACCOUNT_REQUESTS_HREF = "/admin/account-requests";

export type AdministrativeDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Administrator-only destinations; never shown to other Users. */
export const ADMIN_NAVIGATION: readonly AdministrativeDestination[] = [
  { href: "/admin/access", label: "Access", icon: LayoutGrid },
  { href: "/admin/users", label: "User management", icon: UserRound },
  { href: ACCOUNT_REQUESTS_HREF, label: "Account requests", icon: UserRoundPlus },
  { href: "/admin/system-logs", label: "System logs", icon: FileClock },
];

/** Every User's own Activity log (the /my-logs page). Not in Figma; a reviewed addition from Spec#51. */
export const MY_LOGS_DESTINATION: AdministrativeDestination = {
  href: "/my-logs",
  label: "Activity log",
  icon: UserRoundClock,
};

export type SidebarSection = {
  /** Heading shown above the section; unlabelled sections have none. */
  label?: string;
  destinations: readonly AdministrativeDestination[];
};

const byHref = (href: string) => ADMIN_NAVIGATION.find((destination) => destination.href === href)!;

/** The sidebar, in order: Access, then MANAGEMENT and AUDIT (Figma "Portal sidebar"). */
export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  { destinations: [byHref("/admin/access")] },
  { label: "MANAGEMENT", destinations: [byHref("/admin/users"), byHref(ACCOUNT_REQUESTS_HREF)] },
  { label: "AUDIT", destinations: [byHref("/admin/system-logs"), MY_LOGS_DESTINATION] },
];

/** Every sidebar destination, flattened in display order. */
export const SIDEBAR_NAVIGATION: readonly AdministrativeDestination[] = SIDEBAR_SECTIONS.flatMap(
  ({ destinations }) => destinations,
);
