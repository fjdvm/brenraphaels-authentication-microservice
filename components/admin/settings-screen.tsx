"use client";

import { useState } from "react";

import { ApprovalLimitForm } from "@/components/admin/approval-limit-form";
import { PaymentAccountsView } from "@/components/admin/payment-accounts-view";
import { ServiceLevelsForm, type Targets } from "@/components/admin/service-levels-form";
import { FigmaIcon } from "@/components/ui/figma-icon";
import type { PaymentAccount } from "@/lib/settings/payment-accounts";
import { cn } from "@/lib/utils/cn";

type Tab = "general" | "payments" | "service-levels";

const TABS: { id: Tab; label: string; title: string; description: string }[] = [
  {
    id: "general",
    label: "General",
    title: "Settings",
    description: "Settings for every Bren Raphael's system, grouped by topic. Use \"All systems\" to filter.",
  },
  {
    id: "payments",
    label: "Payments",
    title: "Payment details",
    description: "Where customers send money for GCash, Maya and bank transfer. Shown at checkout, on the order confirmation and in My orders.",
  },
  {
    id: "service-levels",
    label: "Service levels",
    title: "SLA, triage & routing",
    description:
      "How tickets get their priority and who gets them. Reply and resolve targets are the same for every priority; priority decides who is alerted and when.",
  },
];

/**
 * Figma "Portal · Settings · General" and "· SLA, triage & routing": breadcrumb, title with Role pill, the one Save
 * changes button (Admin only, supplied by the active tab's form), tab bar and two-column cards.
 */
export function SettingsScreen({
  canEdit,
  roleName,
  centavos,
  targets,
  accounts,
}: {
  canEdit: boolean;
  roleName: string;
  centavos: number | null;
  targets: Targets | null;
  accounts: PaymentAccount[] | null;
}) {
  const [tab, setTab] = useState<Tab>("general");
  const [saveSlot, setSaveSlot] = useState<HTMLElement | null>(null);
  const current = TABS.find((candidate) => candidate.id === tab) ?? TABS[0];

  return (
    <div className="flex flex-col gap-4 leading-[normal]">
      <p className="flex gap-1.5 text-[13px] font-medium">
        <span className="text-on-surface-variant">Settings</span>
        <span className="text-foreground">/ {current.label}</span>
      </p>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-foreground">{current.title}</h1>
            <span className="rounded-full bg-[#f1f1f3] px-2.5 py-[3px] text-xs font-medium text-[#52525b]">{roleName}</span>
          </div>
          <p className="text-sm text-on-surface-variant">{current.description}</p>
        </div>
        <div className="shrink-0" ref={setSaveSlot} />
      </div>
      <div aria-label="Settings" className="flex items-center gap-1" role="tablist">
        {TABS.map((item) => (
          <button
            aria-controls={`settings-panel-${item.id}`}
            aria-selected={tab === item.id}
            className={cn(
              "rounded-lg px-2.5 py-[7px] text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === item.id ? "bg-[#efe8f7] font-semibold text-identity" : "font-medium text-[#52525b] hover:text-foreground",
            )}
            id={`settings-tab-${item.id}`}
            key={item.id}
            onClick={() => setTab(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div aria-labelledby="settings-tab-general" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_440px]" hidden={tab !== "general"} id="settings-panel-general" role="tabpanel">
        <ApprovalLimitForm active={tab === "general"} canEdit={canEdit} initialCentavos={centavos} saveSlot={saveSlot} />
        <p className="flex items-start gap-2.5 rounded-[10px] bg-[#f1f1f3] p-3 text-xs text-[#52525b]">
          <FigmaIcon className="shrink-0" name="check-16" />
          Changes are saved to Activity logs with your name.
        </p>
      </div>
      <div aria-labelledby="settings-tab-payments" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_440px]" hidden={tab !== "payments"} id="settings-panel-payments" role="tabpanel">
        <PaymentAccountsView active={tab === "payments"} canEdit={canEdit} initial={accounts} saveSlot={saveSlot} />
      </div>
      <div aria-labelledby="settings-tab-service-levels" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_440px]" hidden={tab !== "service-levels"} id="settings-panel-service-levels" role="tabpanel">
        <ServiceLevelsForm active={tab === "service-levels"} canEdit={canEdit} initial={targets} saveSlot={saveSlot} />
      </div>
    </div>
  );
}
