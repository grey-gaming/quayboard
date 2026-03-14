import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export const Card = ({ children, className = "", ...props }: CardProps) => (
  <div
    className={[
      "rounded-[calc(var(--radius)+6px)] border border-border/70 bg-card/95 p-6 shadow-harbor backdrop-blur",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </div>
);
