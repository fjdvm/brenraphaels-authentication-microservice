import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-on-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        // Figma "Portal UI/UX" pills: Role, status and module-count badges.
        identity: "border-transparent bg-identity-badge py-[3px] font-medium leading-[normal] text-identity",
        muted: "border-transparent bg-badge-muted py-[3px] font-medium leading-[normal] text-badge-muted-foreground",
        success: "border-transparent bg-badge-success py-[3px] font-medium leading-[normal] text-badge-success-foreground",
        warning: "border-transparent bg-badge-warning py-[3px] font-medium leading-[normal] text-badge-warning-foreground",
        danger: "border-transparent bg-badge-danger py-[3px] font-medium leading-[normal] text-badge-danger-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
