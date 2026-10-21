import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MY_LOGS_DESTINATION } from "@/lib/admin/navigation";

type AccountCardUser = { username: string; email: string; roleName: string };

/**
 * Figma "Staff home" Your account card. The Activity log link is a reviewed no-Figma
 * addition (Spec#51), styled as the card's outlined button.
 */
export function AccountCard({ user }: { user: AccountCardUser }) {
  const rows = [
    ["Username", user.username],
    ["Email", user.email],
    ["Role", user.roleName],
  ] as const;
  const Icon = MY_LOGS_DESTINATION.icon;

  return (
    <section
      aria-labelledby="your-account"
      className="flex flex-col items-start gap-3.5 rounded-xl border border-panel-border bg-surface p-5"
    >
      <h2 id="your-account" className="text-[15px] font-semibold leading-[normal] text-foreground">
        Your account
      </h2>
      <dl className="flex w-full flex-col gap-3.5 text-[13px] leading-[normal]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex w-full items-start gap-3">
            <dt className="min-w-px flex-1 text-on-surface-variant">{label}</dt>
            <dd className="min-w-0 truncate font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <Button asChild variant="row-action" size="cta" className="w-full">
        <Link href={MY_LOGS_DESTINATION.href}>
          <Icon aria-hidden="true" />
          View {MY_LOGS_DESTINATION.label.toLowerCase()}
        </Link>
      </Button>
    </section>
  );
}
