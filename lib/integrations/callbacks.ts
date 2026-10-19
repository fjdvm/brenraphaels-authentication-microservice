const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * A callback may be registered only if it is an absolute https URL (http only on
 * loopback for local development), without credentials or a fragment. Returns the
 * normalised URL string, or null when it must be refused.
 */
export function normalizeCallbackUrl(value: string): string | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    return null;
  }

  if (url.username || url.password || url.hash) {
    return null;
  }

  return url.toString();
}

/** A loopback callback is for local development and is never honoured in production. */
export function isCallbackAllowed(callback: string, nodeEnv = process.env.NODE_ENV): boolean {
  if (nodeEnv !== "production") {
    return true;
  }

  try {
    return !LOOPBACK_HOSTS.has(new URL(callback).hostname);
  } catch {
    return false;
  }
}

/** Adds seeded callbacks to those already registered, never dropping an operator's own. */
export function mergeCallbackUrls(registered: string[], seeded: string[]): string[] {
  return [...new Set([...registered, ...seeded])];
}
