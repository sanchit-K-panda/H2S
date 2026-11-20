import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./button";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-chip px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy text-white",
        secondary: "border-transparent bg-slate-100 text-skytext",
        outline: "border border-skyborder text-skytext",
        ontime: "bg-status-ontime-bg text-status-ontime border border-status-ontime/20",
        minor: "bg-status-minor-bg text-status-minor border border-status-minor/20",
        severe: "bg-status-severe-bg text-status-severe border border-status-severe/20",
        cancelled: "bg-status-cancelled-bg text-status-cancelled border border-status-cancelled/20",
        spare: "bg-status-spare-bg text-status-spare border border-status-spare/20",
        accent: "bg-blue-50 text-skyaccent border border-skyaccent/20",
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
