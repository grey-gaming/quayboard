import type { HTMLAttributes, PropsWithChildren } from "react";

type AlertProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    tone?: "error" | "info";
  }
>;

export const Alert = ({
  children,
  className = "",
  tone = "info",
  ...props
}: AlertProps) => (
  <div
    className={[
      "rounded-lg border px-3 py-2 text-sm",
      tone === "error"
        ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
        : "border-border/70 bg-muted/60 text-foreground",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </div>
);
