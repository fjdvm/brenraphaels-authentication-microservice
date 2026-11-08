import { auth } from "@/lib/auth/server";

// Optimistic check only: sends visitors without a session to /login. Whether a User
// may actually proceed (Deleted, must change password, Super Admin) is decided from the
// database inside each page and Server Action, never here. The authorize endpoint is
// excluded below: it decides for itself and must keep a signed-out System's request
// through login, which a blanket redirect to /login here would drop.
export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: [
    "/((?!login|forgot-password|reset-password|api/health$|api/notifications(?:/|$)|api/auth|api/integrations/authorize$|api/integrations/exchange|api/integrations/validate|api/integrations/recipients$|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo-mark.png|logo.png).*)",
  ],
};
