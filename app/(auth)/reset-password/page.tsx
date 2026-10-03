import { AuthPage } from "@/components/auth/auth-card";
import { InvalidResetLink, ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; e?: string | string[]; s?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <AuthPage>
      {token ? (
        <ResetPasswordForm
          token={token}
          email={typeof params.e === "string" ? params.e : undefined}
          signature={typeof params.s === "string" ? params.s : undefined}
        />
      ) : (
        <InvalidResetLink />
      )}
    </AuthPage>
  );
}
