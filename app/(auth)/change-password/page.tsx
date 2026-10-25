import { AuthPage } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requirePasswordChangeUser } from "@/lib/auth/session";
import { viewReturnIntent } from "@/lib/integrations/return-intent";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ ri?: string | string[] }>;
}) {
  await requirePasswordChangeUser();
  const intent = viewReturnIntent((await searchParams).ri);

  return (
    <AuthPage>
      <ChangePasswordForm
        returnIntent={intent.token}
        systemName={intent.systemName}
        requestProblem={intent.problem}
      />
    </AuthPage>
  );
}
