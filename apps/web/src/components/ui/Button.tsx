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
      "inline-flex min-h-10 items-center justify-center border px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] transition-colors duration-150 focus-visible:border-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent/40 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-panel disabled:text-muted-foreground",
      variant === "primary"
        ? "border-accent bg-accent text-background hover:border-accent-hover hover:bg-accent-hover"
        : variant === "secondary"
          ? "border-border-strong/70 bg-panel-raised text-foreground hover:border-accent/45 hover:bg-panel-active"
          : variant === "danger"
            ? "border-danger/70 bg-danger/10 text-foreground hover:bg-danger/16"
            : "border-transparent bg-transparent text-secondary hover:border-border hover:bg-panel-inset hover:text-foreground",
      className,
    ].join(" ")}
    type={type}
    {...props}
  >
    {children}
  </button>
);
