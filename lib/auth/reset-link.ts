import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// The reset link Neon Auth emails only carries a token. We also want to know *which*
// User finished the reset, so that completing it clears "Awaiting first login". The
// email is added to the link's redirect URL together with an HMAC only this server can
// produce, and only ever sent to that User's own inbox, so it can't be swapped for
// someone else's.

function sign(email: string): string {
  return createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET!)
    .update(`password-reset:${email}`)
    .digest("base64url");
}

export function resetLinkParams(email: string): { e: string; s: string } {
  return { e: email, s: sign(email) };
}

export function verifyResetLinkEmail(
  email: string | undefined,
  signature: string | undefined,
): string | null {
  if (!email || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(email));
  const received = Buffer.from(signature);

  return expected.length === received.length &&
    timingSafeEqual(expected, received)
    ? email
    : null;
}
