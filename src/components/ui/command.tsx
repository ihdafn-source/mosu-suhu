import React from "react";

const Command: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", ...props }) => (
  <div className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground ${className}`} {...props} />
);

const CommandInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = "", ...props }) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <input
      className={`flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  </div>
);

const CommandList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", ...props }) => (
  <div className={`max-h-[300px] overflow-y-auto overflow-x-hidden ${className}`} {...props} />
);

const CommandEmpty: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", ...props }) => (
  <div className={`py-6 text-center text-sm ${className}`} {...props} />
);

const CommandGroup: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", ...props }) => (
  <div className={`overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground ${className}`} {...props} />
);

const CommandItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { value?: string; onSelect?: () => void }> = ({ className = "", ...props }) => (
  <div
    className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    {...props}
  />
);

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };