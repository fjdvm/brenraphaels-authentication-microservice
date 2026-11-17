/* eslint-disable @next/next/no-img-element */
/** The icons copied from the Figma file ("Portal UI/UX"), served from public/icons/figma. Colour is part of each SVG. */
export type FigmaIconName =
  | "arrow-right" | "back" | "badge" | "box" | "check-11" | "check-12" | "chevron-down" | "chevron-right"
  | "inbox-16" | "info-14" | "info-16" | "minus-12" | "shield-12" | "shield-16" | "store" | "users" | "x";

const SIZE: Record<FigmaIconName, number> = {
  "arrow-right": 16, back: 16, badge: 16, box: 16, "check-11": 11, "check-12": 12, "chevron-down": 16,
  "chevron-right": 16, "inbox-16": 16, "info-14": 14, "info-16": 16, "minus-12": 12, "shield-12": 12,
  "shield-16": 16, store: 16, users: 16, x: 18,
};

export function FigmaIcon({ name, className }: { name: FigmaIconName; className?: string }) {
  const size = SIZE[name];
  return <img alt="" aria-hidden="true" className={className} height={size} src={`/icons/figma/${name}.svg`} width={size} />;
}
