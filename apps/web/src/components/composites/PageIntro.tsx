export const PageIntro = ({
  eyebrow,
  summary,
  title,
}: {
  eyebrow?: string;
  summary: string;
  title: string;
}) => (
  <div className="space-y-2">
    {eyebrow ? (
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {eyebrow}
      </p>
    ) : null}
    <h1 className="font-display text-3xl tracking-tight">{title}</h1>
    <p className="max-w-3xl text-sm text-muted-foreground">{summary}</p>
  </div>
);
