"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { FigmaIcon } from "@/components/ui/figma-icon";
import { cn } from "@/lib/utils/cn";

const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;

/** Figma "Portal UI/UX" dialog: a white card over the purple-black scrim, closed by its X. */
function DialogContent({ className, children, onOpenAutoFocus, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-surface leading-[normal] shadow-[0_20px_48px_rgb(0_0_0/0.2)] outline-none",
          className,
        )}
        // Focus the card itself, as Figma shows no control focused; Tab then reaches every control.
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

const HEADER_ICON_TONES = {
  identity: "bg-brand-badge text-identity",
  danger: "bg-danger-soft text-danger-text",
} as const;

type DialogHeaderProps = {
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof HEADER_ICON_TONES;
};

/** Title, description, an optional round icon and the close X. */
function DialogHeader({ title, description, icon, tone = "identity" }: DialogHeaderProps) {
  return (
    <div className="flex shrink-0 items-start gap-3 pt-5 pr-4.5 pb-4 pl-6">
      {icon ? (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
            HEADER_ICON_TONES[tone],
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="text-[13px] text-on-surface-variant">{description}</DialogPrimitive.Description>
      </div>
      <DialogPrimitive.Close
        aria-label="Close"
        className="rounded-md p-1 text-on-surface-variant outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FigmaIcon name="x" />
      </DialogPrimitive.Close>
    </div>
  );
}

function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 overflow-y-auto px-6 pt-1 pb-5", className)} {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-dialog-divider bg-dialog-footer px-6 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader };
