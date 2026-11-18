/** The CRMS Module for Payment Management and Delivery Management (fjdvm/epic-crms#577). */
export const MANAGEMENT_MODULE = "Management";

/** Only these Roles may hold it; Staff and Admin never can, whatever the Admin ticks. */
export const MANAGEMENT_ROLES: readonly string[] = ["CRMS Manager", "CREOMS Manager", "CEO"];

export const MANAGEMENT_REFUSAL = "The Management Module can only be given to a Manager or the CEO.";

/** True when the Module selection includes Management and the Role is not allowed to hold it. */
export function managementRefused(roleName: string | null, selectsManagement: boolean): boolean {
  return selectsManagement && !(roleName !== null && MANAGEMENT_ROLES.includes(roleName));
}
