const foundationItems = [
  "pnpm workspace scaffold for API, web, MCP, and shared packages",
  "Fastify health endpoint and Drizzle migration harness",
  "Tailwind Harbor Night tokens without premature design-system components",
];

export const App = () => {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section className="mx-auto flex max-w-4xl flex-col gap-10 rounded-[calc(var(--radius)+8px)] border border-border/70 bg-card/95 p-8 shadow-harbor backdrop-blur">
        <div className="flex flex-col gap-4">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Quayboard
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Repository and Toolchain Foundations
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            M0 establishes the runnable monorepo, local development baseline, and
            verification wiring without pulling product features forward.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {foundationItems.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm leading-6 text-card-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};
