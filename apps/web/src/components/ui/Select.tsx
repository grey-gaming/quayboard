import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", ...props }, ref) => (
  <select
    ref={ref}
    className={[
      "min-h-10 w-full border border-input bg-panel-inset px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 focus-visible:border-accent focus-visible:bg-panel-active focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent/35",
      className,
    ].join(" ")}
    {...props}
  />
));

Select.displayName = "Select";
