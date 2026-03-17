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
      "border-l-2 border px-3 py-2.5 text-sm",
      tone === "error"
        ? "border-danger bg-danger/10 text-foreground"
        : tone === "success"
          ? "border-success bg-success/10 text-foreground"
          : "border-accent bg-panel-inset text-foreground",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </div>
);
