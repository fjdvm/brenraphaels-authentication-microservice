/**
 * The product is named CREOMS on screen. The stored System, Role and audit Source names still say
 * "CRMS", and integrations match on them, so only what a person reads is renamed, never the value.
 */
export function uiLabel(text: string): string {
  return text.replace(/\bCRMS\b/g, "CREOMS");
}
