import type { HTMLAttributes, PropsWithChildren } from "react";

type AlertProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    tone?: "error" | "info" | "success";
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
      "rounded-md border px-3 py-2 text-sm",
      tone === "error"
        ? "border-danger/50 bg-danger/10 text-foreground"
        : tone === "success"
          ? "border-success/50 bg-success/10 text-foreground"
          : "border-info/35 bg-panel/70 text-foreground",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </div>
);
