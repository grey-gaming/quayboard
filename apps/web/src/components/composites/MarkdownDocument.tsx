import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

const inlineCodeClassName =
  "border border-border/70 bg-panel-inset px-1.5 py-0.5 font-mono text-[0.92em] text-foreground";

const toDocsHref = (href: string) => {
  if (href === "README.md") {
    return "/docs";
  }

  if (href.endsWith(".md") && !href.includes("/")) {
    return `/docs/${href.replace(/\.md$/, "").toLowerCase()}`;
  }

  return href;
};

export const MarkdownDocument = ({ markdown }: { markdown: string }) => (
  <ReactMarkdown
    components={{
      a: ({ children, href }) => {
        const target = toDocsHref(href ?? "");
        const isInternal = target.startsWith("/");

        if (isInternal) {
          return (
            <Link
              className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
              to={target}
            >
              {children}
            </Link>
          );
        }

        return (
          <a
            className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
            href={target}
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        );
      },
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-accent/60 pl-4 text-secondary">
          {children}
        </blockquote>
      ),
      code: ({ children, className }) => {
        if (className) {
          return (
            <code className="block overflow-x-auto border border-border/80 bg-panel-inset p-4 font-mono text-sm text-foreground">
              {children}
            </code>
          );
        }

        return <code className={inlineCodeClassName}>{children}</code>;
      },
      h1: ({ children }) => (
        <h1 className="font-display text-[1.9rem] font-semibold tracking-[-0.02em]">
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 className="mt-8 border-t border-border/80 pt-5 font-display text-[1.35rem] font-semibold tracking-[-0.02em]">
          {children}
        </h2>
      ),
      h3: ({ children }) => <h3 className="mt-6 text-lg font-semibold">{children}</h3>,
      hr: () => <hr className="border-border/80" />,
      li: ({ children }) => <li className="leading-7 text-foreground">{children}</li>,
      ol: ({ children }) => <ol className="ml-6 list-decimal space-y-2">{children}</ol>,
      p: ({ children }) => <p className="leading-7 text-secondary">{children}</p>,
      pre: ({ children }) => <pre className="my-4">{children as ReactNode}</pre>,
      table: ({ children }) => (
        <div className="my-4 overflow-x-auto border border-border/80">
          <table className="min-w-full divide-y divide-border/80">{children}</table>
        </div>
      ),
      tbody: ({ children }) => <tbody className="divide-y divide-border/70">{children}</tbody>,
      td: ({ children }) => <td className="px-3 py-2 align-top text-sm text-secondary">{children}</td>,
      th: ({ children }) => (
        <th className="bg-panel-inset px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {children}
        </th>
      ),
      thead: ({ children }) => <thead>{children}</thead>,
      tr: ({ children }) => <tr className="bg-panel">{children}</tr>,
      ul: ({ children }) => <ul className="ml-6 list-disc space-y-2">{children}</ul>,
    }}
    remarkPlugins={[remarkGfm]}
  >
    {markdown}
  </ReactMarkdown>
);
