import Link from "next/link";
import { connection } from "next/server";

import { UpdatePasswordForm } from "@/components/portal/update-password-form";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { readLastPasswordChangeTime } from "@/lib/audit/audit-logs.server";
import { requirePortalUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/notifications/relative-time";

const STAY_SIGNED_IN = "You'll stay signed in on this device.";

/** Figma "Portal · Member · Change password". */
export default async function ChangePasswordPage() {
  await connection();
  await requirePortalUser();

  const changedAt = await readLastPasswordChangeTime();
  const subtitle = changedAt ? `Changed ${relativeTime(changedAt, new Date())}. ${STAY_SIGNED_IN}` : STAY_SIGNED_IN;

  return (
    <main className="flex w-full flex-1 flex-col gap-5 bg-canvas px-4 pt-9 pb-7 sm:px-6 xl:px-40">
      <div className="flex flex-col gap-2 leading-[normal]">
        <Link className="flex items-center gap-1.5 self-start text-sm font-semibold text-identity" href="/">
          <FigmaIcon name="back-purple" />
          Back to home
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Change password</h1>
          <p className="text-sm text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      <UpdatePasswordForm />
    </main>
  );
}
