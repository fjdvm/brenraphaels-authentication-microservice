import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getPortalUser } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/integrations/return-to";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string | string[]; returnTo?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getPortalUser(), searchParams]);

  const returnTo = safeReturnTo(params.returnTo);

  if (user) {
    redirect(user.mustChangePassword ? "/change-password" : (returnTo ?? "/"));
  }

  return (
    <AuthPage>
      <LoginForm passwordWasReset={params.reset === "1"} returnTo={returnTo} />
    </AuthPage>
  );
}
