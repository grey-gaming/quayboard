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
  <div className="border-b border-border/70 pb-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{summary}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
    {meta ? <div className="mt-4 flex flex-wrap gap-2">{meta}</div> : null}
  </div>
);
