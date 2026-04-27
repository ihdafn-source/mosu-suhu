import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function TooltipProvider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

function Tooltip({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative inline-flex", className)} {...props} />;
}

function TooltipTrigger({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(className)} {...props} />;
}

function TooltipContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md bg-foreground px-2 py-1 text-xs text-background", className)} {...props} />;
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
