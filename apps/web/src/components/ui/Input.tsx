import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={[
        "min-h-10 w-full border border-input bg-panel-inset px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-accent focus-visible:bg-panel-active focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent/35 disabled:bg-panel disabled:text-muted-foreground",
        className,
      ].join(" ")}
      {...props}
    />
  ),
);

Input.displayName = "Input";
