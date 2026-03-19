type AiAutomationRunIconProps = {
  active?: boolean;
  className?: string;
};

export const AiAutomationRunIcon = ({
  active = false,
  className = "",
}: AiAutomationRunIconProps) => (
  <svg
    aria-hidden="true"
    className={["qb-ai-icon", className].join(" ").trim()}
    data-active={active ? "true" : "false"}
    fill="none"
    height="18"
    viewBox="0 0 20 20"
    width="18"
  >
    <g
      className="qb-ai-icon-wheel"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.55"
    >
      <circle cx="10" cy="10" r="5.8" />
      <circle cx="10" cy="10" r="1.55" />
      <path d="M10 2.8V8.1" />
      <path d="M10 11.9V17.2" />
      <path d="M17.2 10H11.9" />
      <path d="M8.1 10H2.8" />
      <path d="M15.1 4.9L11.35 8.65" />
      <path d="M8.65 11.35L4.9 15.1" />
      <path d="M15.1 15.1L11.35 11.35" />
      <path d="M8.65 8.65L4.9 4.9" />
    </g>
    <g className="qb-ai-icon-handles" fill="currentColor">
      <circle cx="10" cy="2.55" r="1.1" />
      <circle cx="17.45" cy="10" r="1.1" />
      <circle cx="10" cy="17.45" r="1.1" />
      <circle cx="2.55" cy="10" r="1.1" />
      <circle cx="15.35" cy="4.65" r="1.05" />
      <circle cx="15.35" cy="15.35" r="1.05" />
      <circle cx="4.65" cy="15.35" r="1.05" />
      <circle cx="4.65" cy="4.65" r="1.05" />
    </g>
  </svg>
);
