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
      "border p-4 md:p-5",
      surface === "inset"
        ? "border-border/80 bg-panel-inset"
        : surface === "rail"
          ? "border-border/90 bg-panel"
          : "border-border-strong/70 bg-panel-raised",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </div>
);
