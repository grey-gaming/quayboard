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
      "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em]",
      tone === "success"
        ? "border-success/50 bg-success/12 text-success"
        : tone === "warning"
          ? "border-warning/50 bg-warning/10 text-warning"
          : tone === "danger"
            ? "border-danger/50 bg-danger/10 text-danger"
            : tone === "info"
              ? "border-info/45 bg-info/12 text-foreground"
              : "border-border bg-panel/80 text-muted-foreground",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </span>
);
