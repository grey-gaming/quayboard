import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", ...props }, ref) => (
  <select
    ref={ref}
    className={[
      "w-full rounded-md border border-input bg-panel/88 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20",
      className,
    ].join(" ")}
    {...props}
  />
));

Select.displayName = "Select";
