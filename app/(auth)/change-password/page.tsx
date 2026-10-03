import { AuthPage } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requirePortalUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requirePortalUser({ allowMustChangePassword: true });

  return (
    <AuthPage>
      <ChangePasswordForm />
    </AuthPage>
  );
}
