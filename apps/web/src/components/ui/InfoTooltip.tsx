type InfoTooltipProps = {
  text: string;
};

export const InfoTooltip = ({ text }: InfoTooltipProps) => (
  <span className="group relative inline-flex items-center">
    <span
      aria-hidden="true"
      className="flex h-3.5 w-3.5 cursor-default items-center justify-center rounded-full border border-border/60 text-[9px] font-semibold leading-none text-muted-foreground transition-colors group-hover:border-border-strong group-hover:text-secondary"
    >
      ?
    </span>
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded border border-border bg-panel-raised px-2.5 py-2 text-[11px] leading-relaxed text-secondary opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
    >
      {text}
    </span>
  </span>
);
