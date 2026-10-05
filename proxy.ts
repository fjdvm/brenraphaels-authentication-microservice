import { auth } from "@/lib/auth/server";

// Optimistic check only: sends visitors without a session to /login. Whether a User
// may actually proceed (Deleted, must change password, Super Admin) is decided from the
// database inside each page and Server Action, never here.
export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: [
    "/((?!login|forgot-password|reset-password|api/auth|api/integrations/exchange|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo-mark.png|logo.png).*)",
  ],
};
