import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256 of a high-entropy bearer value (code, handle, System secret). Only this is stored. */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function secretMatchesHash(secret: string, hash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** PKCE S256: base64url(SHA-256(verifier)). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
