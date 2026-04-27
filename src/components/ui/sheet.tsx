import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Sheet({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

function SheetContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fixed right-0 top-0 h-full w-80 border-l border-border bg-card p-4 shadow-xl", className)} {...props} />;
}

function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

function SheetTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

function SheetDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle };
