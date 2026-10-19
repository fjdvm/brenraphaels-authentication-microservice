import { logoutAction } from "@/actions/auth";

export const dynamic = "force-dynamic";

/**
 * Where a System sends the browser to sign the User out of every System: it ends the central
 * session (revoking every handle issued from it) and lands on /login. A System's sign-out button
 * POSTs to the System, which answers 303 here, so the browser arrives as a GET.
 */
/** logoutAction always ends in a redirect to /login, which Next raises as a thrown redirect. */
async function signOut(): Promise<Response> {
  await logoutAction();

  return new Response(null, { status: 204 });
}

export const GET = signOut;
export const POST = signOut;
