import { BrandLogo } from "@/components/ui/brand-logo";
import { cn } from "@/lib/utils/cn";

const LOCKUP_SIZES = {
  // Figma "Portal sidebar" brand block.
  sidebar: { logo: 44, radius: "rounded-[10px]", title: "text-xl/[normal]", gap: "gap-1.5", badge: "py-[3px]" },
  // Figma "Staff home" top bar.
  header: { logo: 40, radius: "rounded-[9px]", title: "text-lg/[normal]", gap: "gap-1", badge: "py-0.5" },
} as const;

type BrandLockupProps = {
  size: keyof typeof LOCKUP_SIZES;
  className?: string;
};

export function BrandLockup({ size, className }: BrandLockupProps) {
  const { logo, radius, title, gap, badge } = LOCKUP_SIZES[size];

  return (
    <div className={cn("flex min-w-0 items-center gap-[11px]", className)}>
      <BrandLogo className={cn("shrink-0 bg-black", radius)} size={logo} />
      <div className={cn("flex min-w-0 flex-col items-start", gap)}>
        <span className={cn("truncate font-bold text-foreground", title)}>Bren Raphael&apos;s</span>
        <span className={cn("rounded-md bg-brand-badge px-2 text-[11px] font-semibold leading-[normal] text-brand-badge-foreground", badge)}>
          Enterprise Suite
        </span>
      </div>
    </div>
  );
}
