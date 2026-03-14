import type { LabelHTMLAttributes, PropsWithChildren } from "react";

type LabelProps = PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>;

export const Label = ({ children, className = "", ...props }: LabelProps) => (
  <label
    className={["text-sm font-medium text-foreground", className].join(" ")}
    {...props}
  >
    {children}
  </label>
);
