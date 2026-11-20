import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./button";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-skyaccent",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy text-white",
        secondary: "border border-slate-200 bg-slate-100 text-slate-700",
        outline: "border border-slate-200 bg-white text-slate-700",
        ontime: "bg-status-ontime-bg text-status-ontime border border-status-ontime-border",
        minor: "bg-status-minor-bg text-status-minor border border-status-minor-border",
        severe: "bg-status-severe-bg text-status-severe border border-status-severe-border",
        cancelled: "bg-status-cancelled-bg text-status-cancelled border border-status-cancelled-border",
        spare: "bg-status-spare-bg text-status-spare border border-status-spare-border",
        accent: "bg-blue-50 text-skyaccent border border-blue-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
