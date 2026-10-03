import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

// Neon Auth owns credentials, sessions and reset emails. Everything portal-specific
// (Username, Role, must-change-password, Deleted) lives in our own `User` table.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
