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
    <g className="qb-ai-icon-orbit" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6">
      <ellipse cx="10" cy="10" rx="7.1" ry="4.5" transform="rotate(-20 10 10)" />
    </g>
    <g className="qb-ai-icon-nodes" fill="currentColor">
      <circle cx="15.6" cy="7.2" r="1.45" />
    </g>
    <path
      className="qb-ai-icon-spark"
      d="M10 4.6L11.25 8.75L15.4 10L11.25 11.25L10 15.4L8.75 11.25L4.6 10L8.75 8.75L10 4.6Z"
      fill="currentColor"
    />
  </svg>
);
