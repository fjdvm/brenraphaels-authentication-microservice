import { AuthPage } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requirePasswordChangeUser } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/integrations/return-to";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const [, params] = await Promise.all([requirePasswordChangeUser(), searchParams]);

  return (
    <AuthPage>
      <ChangePasswordForm returnTo={safeReturnTo(params.returnTo)} />
    </AuthPage>
  );
}
