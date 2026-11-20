import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyaccent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-navy text-white hover:bg-navy/90 shadow-subtle active:scale-[0.99]",
        primary: "bg-skyaccent text-white hover:bg-skyaccent/90 shadow-subtle active:scale-[0.99]",
        secondary: "bg-slate-100 text-skytext hover:bg-slate-200",
        outline: "border border-skyborder bg-white text-skytext hover:bg-slate-50",
        ghost: "hover:bg-slate-100 text-skymuted hover:text-skytext",
        success: "bg-status-ontime text-white hover:bg-status-ontime/90",
        danger: "bg-status-severe text-white hover:bg-status-severe/90",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-control px-3 text-xs",
        lg: "h-10 rounded-control px-6 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
