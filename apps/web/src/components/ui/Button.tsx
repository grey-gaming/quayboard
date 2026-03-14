import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary";
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
      "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
      variant === "primary"
        ? "bg-accent text-accent-foreground hover:bg-accent/90"
        : "border border-border bg-background/70 text-foreground hover:bg-muted/70",
      className,
    ].join(" ")}
    type={type}
    {...props}
  >
    {children}
  </button>
);
