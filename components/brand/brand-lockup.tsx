import Image from "next/image";

import { cn } from "@/lib/utils/cn";

/** The Figma chef tile: the app icon on a white rounded square. */
export function BrandTile({
  size = 48,
  bordered = false,
  className,
}: {
  size?: number;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-white",
        bordered && "border border-brand-lockup-border",
        className,
      )}
      style={{ width: size, height: size, borderRadius: size / 4 }}
    >
      <Image
        alt=""
        className="object-contain"
        fill
        sizes={`${size}px`}
        src="/images/brand/logo-tile.png"
        style={{ padding: size * 0.0625 }}
      />
    </div>
  );
}

/**
 * The Figma "Logo/Lockup" for the Enterprise Suite: chef tile with "Bren Raphael's"
 * and the system name beside it. Light is for white backgrounds, Dark for purple ones.
 * The text wraps rather than clipping.
 */
export function BrandLockup({
  tone = "Light",
  className,
}: {
  tone?: "Light" | "Dark";
  className?: string;
}) {
  const dark = tone === "Dark";

  return (
    <div className={cn("flex items-center gap-3 text-left", className)}>
      <BrandTile bordered={!dark} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] font-semibold">
        <p
          className={cn(
            "whitespace-nowrap font-[family-name:var(--font-fraunces)] text-[20px] leading-normal",
            dark ? "text-white" : "text-brand-lockup-title",
          )}
          style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1' }}
        >
          Bren Raphael&apos;s
        </p>
        <p
          className={cn(
            "text-[9px] uppercase leading-[12px] tracking-[1.1px]",
            dark ? "text-brand-lockup-subtitle-dark" : "text-brand-lockup-subtitle",
          )}
        >
          Enterprise Suite
        </p>
      </div>
    </div>
  );
}
