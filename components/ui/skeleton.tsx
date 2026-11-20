import * as React from "react";
import { cn } from "./button";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-slate-200/70", className)}
      {...props}
    />
  );
}
