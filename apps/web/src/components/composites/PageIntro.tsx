import type { ReactNode } from "react";

export const PageIntro = ({
  actions,
  eyebrow,
  meta,
  summary,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  meta?: ReactNode;
  summary: string;
  title: string;
}) => (
  <div className="grid gap-4 border-b border-border/80 pb-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        {eyebrow ? (
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] md:text-[1.95rem]">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
    <p className="min-w-0 text-sm leading-6 text-secondary">{summary}</p>
    {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
  </div>
);
