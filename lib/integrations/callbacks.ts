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
