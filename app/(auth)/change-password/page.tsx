import { AuthPage } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requirePasswordChangeUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requirePasswordChangeUser();

  return (
    <AuthPage>
      <ChangePasswordForm />
    </AuthPage>
  );
}
