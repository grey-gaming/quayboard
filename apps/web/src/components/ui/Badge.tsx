import type { HTMLAttributes, PropsWithChildren } from "react";

type BadgeProps = PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & {
    tone?: "neutral" | "info" | "success" | "warning" | "danger";
  }
>;

export const Badge = ({
  children,
  className = "",
  tone = "neutral",
  ...props
}: BadgeProps) => (
  <span
    className={[
      "inline-flex min-h-6 items-center border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
      tone === "success"
        ? "border-success/50 bg-success/12 text-success"
        : tone === "warning"
          ? "border-warning/50 bg-warning/10 text-warning"
          : tone === "danger"
            ? "border-danger/50 bg-danger/10 text-danger"
            : tone === "info"
              ? "border-accent/45 bg-accent/12 text-foreground"
              : "border-border-strong/60 bg-panel-active text-secondary",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </span>
);
