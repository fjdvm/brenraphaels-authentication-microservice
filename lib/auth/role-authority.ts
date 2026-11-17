/**
 * The only place that maps a Role to access on the Portal's admin screens (ADR-0006).
 * Admin has Full access, CEO has View access, every other Role has none.
 */
export type Access = "full" | "view" | "none";

const ACCESS_BY_ROLE: Readonly<Record<string, Access>> = { Admin: "full", CEO: "view" };

/** Roles that may also read the shop Settings through the CRMS Portal Settings Module. */
const SETTINGS_READER_ROLES: readonly string[] = ["CRMS Manager", "CREOMS Manager", "Manager"];

export function accessFor(roleName: string): Access {
  return Object.hasOwn(ACCESS_BY_ROLE, roleName) ? ACCESS_BY_ROLE[roleName] : "none";
}

/** Reading an admin page: View or Full. */
export const canView = (roleName: string) => accessFor(roleName) !== "none";

/** Any write: Full only. A CEO is refused with 403. */
export const canWrite = (roleName: string) => accessFor(roleName) === "full";

/** Reading the shop Settings: admin screens' viewers plus the CRMS managers who use them. */
export const canReadShopSettings = (roleName: string) =>
  canView(roleName) || SETTINGS_READER_ROLES.includes(roleName);
