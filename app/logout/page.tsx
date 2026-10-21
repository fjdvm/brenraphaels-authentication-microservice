import { SignOutRunner } from "@/components/auth/sign-out-runner";

export const dynamic = "force-dynamic";

/**
 * Where a System sends the browser to sign the User out of every System: it ends the central
 * session (revoking every handle issued from it) and lands on /login. A System's sign-out button
 * POSTs to the System, which answers 303 here.
 */
export default function LogoutPage() {
  return <SignOutRunner />;
}
