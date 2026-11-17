import { Info, KeyRound } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MY_LOGS_DESTINATION } from "@/lib/admin/navigation";
import { uiLabel } from "@/lib/utils/ui-label";

type AccountCardProps = {
  username: string;
  email: string;
  roleName: string;
  /** The previous sign-in, already formatted; null shows a dash. */
  lastSignIn: string | null;
  /** Systems the User cannot open, named in the closing hint. */
  otherSystemNames: string[];
};

/** "HRMS, IMS or POS" */
function joinWithOr(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0];
}

const MyLogsIcon = MY_LOGS_DESTINATION.icon;

/** Figma "Staff home" "Your account" card. */
export function AccountCard({ username, email, roleName, lastSignIn, otherSystemNames }: AccountCardProps) {
  const rows = [
    ["Username", username],
    ["Email", email],
    ["Role", uiLabel(roleName)],
    ["Last sign-in", lastSignIn ?? "—"],
  ];

  return (
    <section
      aria-labelledby="account-card-title"
      className="flex w-full shrink-0 flex-col gap-3.5 rounded-xl border border-panel-border bg-surface p-5 leading-[normal] lg:w-[380px]"
    >
      <h2 className="text-[15px] font-semibold text-foreground" id="account-card-title">
        Your account
      </h2>
      <dl className="flex flex-col gap-3.5 text-[13px]">
        {rows.map(([label, value]) => (
          <div className="flex gap-3" key={label}>
            <dt className="flex-1 text-on-surface-variant">{label}</dt>
            <dd className="min-w-0 truncate font-medium text-foreground" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {/* A signed-in User changes their password through the Forgot password email. */}
      <Button asChild className="w-full text-foreground" size="cta" variant="row-action">
        <Link href="/forgot-password">
          <KeyRound aria-hidden="true" />
          Change password
        </Link>
      </Button>
      {/* Not in Figma: the link to My Logs is a reviewed addition from Spec#51 (Ticket#62). */}
      <Button asChild className="w-full text-foreground" size="cta" variant="row-action">
        <Link href={MY_LOGS_DESTINATION.href}>
          <MyLogsIcon aria-hidden="true" />
          View {MY_LOGS_DESTINATION.label.toLowerCase()}
        </Link>
      </Button>
      {otherSystemNames.length > 0 ? (
        <p className="flex gap-2 rounded-lg bg-callout px-3 py-2.5 text-xs text-callout-foreground">
          <Info aria-hidden="true" className="size-4 shrink-0" />
          Need {joinWithOr(otherSystemNames.map(uiLabel))}? Ask an Admin to update your access.
        </p>
      ) : null}
    </section>
  );
}
