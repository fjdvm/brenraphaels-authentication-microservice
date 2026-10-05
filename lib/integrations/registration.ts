import { normalizeCallbackUrl } from "./callbacks";
import { generateToken, hashToken } from "./tokens";

export type SystemRegistration = {
  callbackUrls: string[];
  backendSecretHash: string;
};

/**
 * Builds the stored registration for a System and the one-time backend secret.
 * Callbacks must each be acceptable; the secret is returned for the operator to
 * copy into the System backend's environment and is never stored.
 */
export function buildSystemRegistration(callbacks: string[]): {
  registration: SystemRegistration;
  secret: string;
} {
  if (callbacks.length === 0) {
    throw new Error("Register at least one callback URL.");
  }

  const callbackUrls = callbacks.map((callback) => {
    const normalized = normalizeCallbackUrl(callback);

    if (!normalized) {
      throw new Error(
        `Refusing callback "${callback}": use an absolute https URL (http only for localhost) with no credentials or fragment.`,
      );
    }

    return normalized;
  });

  const secret = generateToken("iss_");

  return {
    registration: { callbackUrls: [...new Set(callbackUrls)], backendSecretHash: hashToken(secret) },
    secret,
  };
}
