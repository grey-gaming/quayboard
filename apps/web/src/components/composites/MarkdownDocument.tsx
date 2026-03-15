import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

const inlineCodeClassName =
  "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground";

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
            <Link className="text-accent hover:underline" to={target}>
              {children}
            </Link>
          );
        }

        return (
          <a
            className="text-accent hover:underline"
            href={target}
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        );
      },
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-accent/60 pl-4 italic text-muted-foreground">
          {children}
        </blockquote>
      ),
      code: ({ children, className }) => {
        if (className) {
          return (
            <code className="block overflow-x-auto rounded-xl bg-background/70 p-4 font-mono text-sm">
              {children}
            </code>
          );
        }

        return <code className={inlineCodeClassName}>{children}</code>;
      },
      h1: ({ children }) => <h1 className="font-display text-4xl tracking-tight">{children}</h1>,
      h2: ({ children }) => (
        <h2 className="mt-8 font-display text-2xl tracking-tight">{children}</h2>
      ),
      h3: ({ children }) => <h3 className="mt-6 text-xl font-semibold">{children}</h3>,
      hr: () => <hr className="border-border/70" />,
      li: ({ children }) => <li className="leading-7 text-foreground/95">{children}</li>,
      ol: ({ children }) => <ol className="ml-6 list-decimal space-y-2">{children}</ol>,
      p: ({ children }) => <p className="leading-7 text-foreground/95">{children}</p>,
      pre: ({ children }) => <pre className="my-4">{children as ReactNode}</pre>,
      ul: ({ children }) => <ul className="ml-6 list-disc space-y-2">{children}</ul>,
    }}
    remarkPlugins={[remarkGfm]}
  >
    {markdown}
  </ReactMarkdown>
);
