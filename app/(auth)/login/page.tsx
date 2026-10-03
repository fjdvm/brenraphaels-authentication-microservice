import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getPortalUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getPortalUser(), searchParams]);

  if (user) {
    redirect(user.mustChangePassword ? "/change-password" : "/");
  }

  return (
    <AuthPage>
      <LoginForm passwordWasReset={params.reset === "1"} />
    </AuthPage>
  );
}
