import type { HTMLAttributes, PropsWithChildren } from "react";

type BadgeProps = PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & {
    tone?: "default" | "success" | "warning";
  }
>;

export const Badge = ({
  children,
  className = "",
  tone = "default",
  ...props
}: BadgeProps) => (
  <span
    className={[
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
      tone === "success"
        ? "bg-emerald-500/20 text-emerald-200"
        : tone === "warning"
          ? "bg-amber-500/20 text-amber-200"
          : "bg-muted text-foreground",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </span>
);
