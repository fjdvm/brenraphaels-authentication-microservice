/** Remove after fjdvm/hrms#317 deploys. This is a compatibility name, never a
 * selectable Module or a grant: old HRMS callers require the entire former area. */
export const LEGACY_HRMS_HIRING = "Recruitment and Hiring";
export const HRMS_HIRING_MODULES = ["Job Postings", "Applications", "Interviews", "Offers"] as const;

export function hasLegacyHiringAccess(modules: string[]): boolean {
  return HRMS_HIRING_MODULES.every((name) => modules.includes(name));
}
