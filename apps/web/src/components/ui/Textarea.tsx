import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={[
      "w-full border border-input bg-panel-inset px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-accent focus-visible:bg-panel-active focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent/35",
      className,
    ].join(" ")}
    {...props}
  />
));

Textarea.displayName = "Textarea";
