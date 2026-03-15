import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
  }
>;

export const Button = ({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) => (
  <button
    className={[
      "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-60",
      variant === "primary"
        ? "border-accent bg-accent/20 text-foreground hover:bg-accent/28"
        : variant === "secondary"
          ? "border-border bg-panel/85 text-foreground hover:border-accent/50 hover:bg-surface"
          : variant === "danger"
            ? "border-danger/60 bg-danger/10 text-foreground hover:bg-danger/18"
            : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-panel/75 hover:text-foreground",
      className,
    ].join(" ")}
    type={type}
    {...props}
  >
    {children}
  </button>
);
