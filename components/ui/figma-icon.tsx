/* eslint-disable @next/next/no-img-element */
/** The icons copied from the Figma file ("Portal UI/UX"), served from public/icons/figma. Colour is part of each SVG. */
export type FigmaIconName =
  | "arrow-right" | "back" | "badge" | "box" | "check-11" | "check-12" | "check-16" | "lock-12" | "chevron-down" | "chevron-right"
  | "alert-16" | "back-purple" | "box-26" | "user-26" | "bell" | "bell-unread" | "check-12-green" | "down-14" | "dot-unread" | "user-16" | "inbox-16" | "info-14" | "info-16" | "minus-12" | "shield-12" | "shield-16" | "store" | "users" | "x";

const SIZE: Record<FigmaIconName, number> = {
  "alert-16": 16, "back-purple": 16, "box-26": 26, "user-26": 26, bell: 36, "bell-unread": 36, "check-12-green": 12, "down-14": 14, "dot-unread": 8, "user-16": 16,
  "arrow-right": 16, back: 16, badge: 16, box: 16, "check-11": 11, "check-12": 12, "check-16": 16, "lock-12": 12, "chevron-down": 16,
  "chevron-right": 16, "inbox-16": 16, "info-14": 14, "info-16": 16, "minus-12": 12, "shield-12": 12,
  "shield-16": 16, store: 16, users: 16, x: 18,
};

export function FigmaIcon({ name, className }: { name: FigmaIconName; className?: string }) {
  const size = SIZE[name];
  // The dot is 8 x 13 in Figma, the one icon that is not square.
  const height = name === "dot-unread" ? 13 : size;
  return <img alt="" aria-hidden="true" className={className} height={height} src={`/icons/figma/${name}.svg`} width={size} />;
}
