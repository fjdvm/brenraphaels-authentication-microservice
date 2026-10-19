const AUTHORIZE_PATH = "/api/integrations/authorize";

/**
 * Where a visitor may be sent back to after signing in or changing their password:
 * only the authorize request itself, never an arbitrary address.
 */
export function safeReturnTo(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(`${AUTHORIZE_PATH}?`)
    ? value
    : null;
}
