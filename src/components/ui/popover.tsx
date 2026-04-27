import React from "react";

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Popover: React.FC<PopoverProps> = ({ children }) => <div className="relative">{children}</div>;

const PopoverTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ children }) => <>{children}</>;

const PopoverContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { align?: string }> = ({ className = "", ...props }) => (
  <div className={`z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${className}`} {...props} />
);

export { Popover, PopoverTrigger, PopoverContent };