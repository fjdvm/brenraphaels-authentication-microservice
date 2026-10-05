import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256 bits of randomness, URL-safe. Used for sign-in codes, handles and System secrets. */
export function generateToken(prefix = ""): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

/**
 * Bearer material is stored only as a SHA-256 hash. The inputs are 256-bit random
 * values, so a fast hash is sufficient; a database leak reveals nothing usable.
 */
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export function isValidCodeChallenge(value: string): boolean {
  return CODE_CHALLENGE.test(value);
}

/** PKCE S256 (RFC 7636): BASE64URL(SHA256(verifier)) must equal the challenge. */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!CODE_VERIFIER.test(codeVerifier)) {
    return false;
  }

  const computed = createHash("sha256").update(codeVerifier).digest("base64url");

  return safeEqual(computed, codeChallenge);
}
