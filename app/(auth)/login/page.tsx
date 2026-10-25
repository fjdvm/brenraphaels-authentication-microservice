import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getPortalUser } from "@/lib/auth/session";
import { viewReturnIntent, withReturnIntent } from "@/lib/integrations/return-intent";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string | string[]; ri?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getPortalUser(), searchParams]);
  const intent = viewReturnIntent(params.ri);

  if (user) {
    // Already signed in: a pending System request resumes at the authorize endpoint,
    // which rechecks access before issuing anything.
    redirect(
      user.mustChangePassword
        ? withReturnIntent("/change-password", intent.token)
        : (intent.authorizePath ?? "/"),
    );
  }

  return (
    <AuthPage>
      <LoginForm
        passwordWasReset={params.reset === "1"}
        returnIntent={intent.token}
        systemName={intent.systemName}
        requestProblem={intent.problem}
      />
    </AuthPage>
  );
}
