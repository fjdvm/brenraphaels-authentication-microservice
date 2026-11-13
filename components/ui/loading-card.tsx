"use client";

import { useId } from "react";

import { BrandTile } from "@/components/brand/brand-lockup";
import { cn } from "@/lib/utils/cn";

/** Waits shorter than this finish without the card flashing up. */
const LOADING_CARD_DELAY_MS = 300;

// The Figma arc runs from 12 o'clock to about 4 o'clock: 35% of the ring.
const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ARC_LENGTH = RING_CIRCUMFERENCE * 0.35;

type LoadingCardProps = {
  title: string;
  subtitle: string;
  delayMs?: number;
};

/**
 * Figma "Loader": a centred card over the blurred, dimmed page. Render it for as long as the
 * wait lasts; it stays hidden for the first `delayMs`. The delay is a CSS animation delay, not
 * a timer, because a state update during a pending form action re-renders without the
 * action's pending status and would unmount the card.
 */
export function LoadingCard({ title, subtitle, delayMs = LOADING_CARD_DELAY_MS }: LoadingCardProps) {
  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-loader-overlay px-4 backdrop-blur-[8px]"
      style={{ animation: `loading-card-in 150ms ease-out ${delayMs}ms both` }}
    >
      <div
        aria-labelledby={titleId}
        className="flex flex-col items-center gap-[18px] rounded-[20px] border border-loader-border bg-white px-10 pb-7 pt-8 shadow-[0_16px_40px_0_rgba(51,26,77,0.12)]"
        role="status"
      >
        <div className="relative size-[72px] shrink-0">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-[72px] animate-spin [animation-duration:1.2s]"
            fill="none"
            viewBox="0 0 72 72"
          >
            <circle className="stroke-loader-track" cx="36" cy="36" r={RING_RADIUS} strokeWidth={4} />
            <circle
              className="stroke-identity"
              cx="36"
              cy="36"
              r={RING_RADIUS}
              strokeDasharray={`${ARC_LENGTH} ${RING_CIRCUMFERENCE}`}
              strokeLinecap="round"
              strokeWidth={4}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <BrandTile className="absolute left-3.5 top-3.5" size={44} />
        </div>
        <div className="flex flex-col items-center gap-1 text-center leading-[normal]">
          <p className="text-[17px] font-semibold text-foreground" id={titleId}>
            {title}
          </p>
          <p className="text-[13px] text-on-surface-variant">{subtitle}</p>
        </div>
        <div aria-hidden="true" className="flex gap-1.5">
          {["bg-identity", "bg-identity/50", "bg-identity/25"].map((tone, index) => (
            <span
              className={cn("size-1.5 rounded-full motion-safe:animate-pulse", tone)}
              key={tone}
              style={{ animationDelay: `${index * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
