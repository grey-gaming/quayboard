import type { ButtonHTMLAttributes, ReactNode } from "react";

import { AiAutomationRunIcon } from "./AiAutomationRunIcon.js";
import { Button } from "./Button.js";

type AiWorkflowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  label: string;
  runningLabel?: string;
};

export const AiWorkflowButton = ({
  active = false,
  className = "",
  icon,
  label,
  runningLabel,
  type = "button",
  variant = "secondary",
  ...props
}: AiWorkflowButtonProps & { variant?: "primary" | "secondary" | "ghost" | "danger" }) => (
  <Button
    aria-busy={active}
    className={["qb-ai-action", className].join(" ").trim()}
    data-active={active ? "true" : "false"}
    type={type}
    variant={variant}
    {...props}
  >
    <span className="qb-ai-action__content">
      {icon ?? <AiAutomationRunIcon active={active} />}
      <span>{active ? runningLabel ?? label : label}</span>
    </span>
  </Button>
);
