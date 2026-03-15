import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    surface?: "panel" | "inset" | "rail";
  }
>;

export const Card = ({
  children,
  className = "",
  surface = "panel",
  ...props
}: CardProps) => (
  <div
    className={[
      "rounded-[calc(var(--radius)+2px)] border p-5 md:p-6",
      surface === "inset"
        ? "border-border/70 bg-panel/75"
        : surface === "rail"
          ? "border-border/90 bg-surface/90"
          : "border-border/90 bg-card/95 shadow-harbor",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </div>
);
