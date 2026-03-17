import type { LabelHTMLAttributes, PropsWithChildren } from "react";

type LabelProps = PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>;

export const Label = ({ children, className = "", ...props }: LabelProps) => (
  <label
    className={[
      "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </label>
);
