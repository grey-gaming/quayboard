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
      "w-full rounded-md border border-input bg-panel/88 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20",
      className,
    ].join(" ")}
    {...props}
  />
));

Textarea.displayName = "Textarea";
