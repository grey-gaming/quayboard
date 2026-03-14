import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", ...props }, ref) => (
  <select
    ref={ref}
    className={[
      "w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30",
      className,
    ].join(" ")}
    {...props}
  />
));

Select.displayName = "Select";
