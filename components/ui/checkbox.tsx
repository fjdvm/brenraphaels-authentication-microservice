"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useRef, type ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  /** Shows the "some, not all" dash, as Figma's partial Select all. */
  indeterminate?: boolean;
};

/** Figma "Portal UI/UX" checkbox: a native input drawn as an 18px violet box. */
export function Checkbox({ className, indeterminate = false, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={cn("relative flex size-4.5 shrink-0", className)}>
      <input
        className="peer size-4.5 cursor-pointer appearance-none rounded-sm border-[1.5px] border-checkbox-border bg-surface outline-none checked:border-checkbox checked:bg-checkbox indeterminate:border-checkbox indeterminate:bg-checkbox focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        ref={ref}
        type="checkbox"
        {...props}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-white peer-checked:block peer-indeterminate:hidden"
        strokeWidth={3}
      />
      <Minus
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-white peer-indeterminate:block"
        strokeWidth={3}
      />
    </span>
  );
}
