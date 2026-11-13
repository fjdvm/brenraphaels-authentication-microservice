import { Lock, Mail, Shield, User, type LucideIcon } from "lucide-react";

import { BrandLockup } from "@/components/brand/brand-lockup";

// Figma Portal "Brand panel" feature rows, in the panel's order.
const FEATURES: { text: string; icon: LucideIcon }[] = [
  { text: "For Bren Raphael's team members only", icon: Lock },
  { text: "Your access is set by an admin", icon: User },
  { text: "Every sign-in is verified by email and logged", icon: Mail },
];

/** The 620px purple panel beside the form on every Portal auth screen. Hidden below `lg`. */
export function AuthBrandPanel() {
  return (
    <aside className="relative hidden w-[620px] shrink-0 flex-col overflow-hidden bg-[linear-gradient(137deg,#1f0f31_14%,#361a56_50%,#5b2a86_86%)] lg:flex">
      <div aria-hidden="true" className="absolute left-[400px] top-[102px] size-[520px] rotate-45 rounded-[72px] bg-white/5" />
      <div aria-hidden="true" className="absolute left-[470px] top-[305px] size-[360px] rotate-45 rounded-[56px] border-[1.5px] border-white/14" />
      <div aria-hidden="true" className="absolute left-[560px] top-[174px] size-[220px] rotate-45 rounded-[36px] border-[1.5px] border-white/8 bg-white/4" />
      <div aria-hidden="true" className="absolute left-[90px] top-[-139px] size-[140px] rotate-45 rounded-[26px] border-[1.5px] border-white/8" />
      <div className="relative flex flex-1 flex-col gap-8 px-16 pb-11 pt-14">
        <BrandLockup tone="Dark" />
        <div className="flex-1" />
        <div className="flex w-[430px] max-w-full flex-col gap-3.5">
          <p className="text-[11px]/[normal] font-semibold uppercase tracking-[1.54px] text-auth-panel-subtitle">
            Internal system · Staff only
          </p>
          <p className="text-[38px]/[1.16] font-bold text-white">
            Everything the team needs to run the business.
          </p>
          <p className="text-[15px]/[1.5] text-auth-panel-body">
            Sign in to open the tools for your role: customers and orders, people, inventory or branch sales.
          </p>
          <ul className="flex flex-col gap-3 pt-2">
            {FEATURES.map(({ text, icon: Icon }) => (
              <li className="flex items-center gap-3" key={text}>
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon aria-hidden="true" className="size-[15px] text-auth-panel-icon" />
                </span>
                <span className="text-sm/[normal] font-medium text-auth-panel-feature">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-[2]" />
        <div className="flex items-center gap-2 text-xs/[normal]">
          <Shield aria-hidden="true" className="size-[15px] shrink-0 text-auth-panel-note" />
          <p className="flex-1 text-auth-panel-note">Protected sign-in with email verification</p>
          <p className="text-auth-panel-copyright">© 2026 Bren Raphael&apos;s · Internal use</p>
        </div>
      </div>
    </aside>
  );
}
