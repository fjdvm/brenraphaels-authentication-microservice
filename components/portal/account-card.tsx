import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FigmaIcon } from "@/components/ui/figma-icon";
import { MY_LOGS_DESTINATION } from "@/lib/admin/navigation";
import { PASSWORD_DESTINATION } from "@/lib/portal/navigation";
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
      className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-panel-border bg-surface p-5 leading-[normal] lg:w-[380px]"
    >
      <h2 className="text-[15px] font-semibold text-foreground" id="account-card-title">
        Your account
      </h2>
      <dl className="flex flex-col gap-3 text-[13px]">
        {rows.map(([label, value]) => (
          <div className="flex items-start justify-between gap-3" key={label}>
            <dt className="text-on-surface-variant">{label}</dt>
            <dd className="min-w-0 truncate font-medium text-foreground" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <Button asChild className="w-full text-foreground" size="cta" variant="row-action">
        <Link href={PASSWORD_DESTINATION.href}>Change password</Link>
      </Button>
      <Button asChild className="w-full gap-1.5 text-foreground" size="cta" variant="row-action">
        <Link href={MY_LOGS_DESTINATION.href}>
          <FigmaIcon name="user-16" />
          View activity log
        </Link>
      </Button>
      {otherSystemNames.length > 0 ? (
        <p className="rounded-lg bg-[#f7f3fb] px-3 py-2.5 text-xs text-identity">
          Need {joinWithOr(otherSystemNames.map(uiLabel))}? Ask an Admin to update your access.
        </p>
      ) : null}
    </section>
  );
}
