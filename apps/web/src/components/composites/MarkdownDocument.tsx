import { Children, isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { buildHeadingId, extractMarkdownHeadings } from "../../lib/markdown.js";
import { Button } from "../ui/Button.js";

const inlineCodeClassName =
  "border border-border/70 bg-panel-inset px-1.5 py-0.5 font-mono text-[0.92em] text-foreground";

const extractTextContent = (children: ReactNode): string =>
  Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return extractTextContent(child.props.children);
      }

      return "";
    })
    .join("")
    .trim();

const toDocsHref = (href: string) => {
  if (href === "README.md") {
    return "/docs";
  }

  if (href.endsWith(".md") && !href.includes("/")) {
    return `/docs/${href.replace(/\.md$/, "").toLowerCase()}`;
  }

  return href;
};

export const MarkdownDocument = ({
  markdown,
  showTableOfContents = false,
}: {
  markdown: string;
  showTableOfContents?: boolean;
}) => {
  const headings = extractMarkdownHeadings(markdown);
  const shouldShowTableOfContents = showTableOfContents && headings.length >= 2;
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const headingCounts = new Map<string, number>();
  let headingIndex = 0;

  const getHeadingId = (level: 2 | 3, children: ReactNode) => {
    const nextHeading = headings[headingIndex];

    if (nextHeading?.level === level) {
      headingIndex += 1;
      return nextHeading.id;
    }

    return buildHeadingId(extractTextContent(children), headingCounts);
  };

  const toc = shouldShowTableOfContents ? (
    <nav aria-label="On this page" className="grid gap-3">
      <p className="qb-meta-label">On this page</p>
      <div className="grid gap-1.5">
        {headings.map((heading) => (
          <a
            key={heading.id}
            className={[
              "border border-border/70 bg-panel-inset px-3 py-2 text-sm leading-6 text-secondary transition-colors duration-150 hover:border-border-strong hover:text-foreground",
              heading.level === 3 ? "ml-4" : "",
            ].join(" ")}
            href={`#${heading.id}`}
          >
            {heading.title}
          </a>
        ))}
      </div>
    </nav>
  ) : null;

  return (
    <div
      className={
        shouldShowTableOfContents
          ? "grid min-w-0 gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]"
          : "min-w-0 overflow-hidden"
      }
    >
      {shouldShowTableOfContents ? (
        <aside className="hidden xl:block">
          <div className="sticky top-24 border border-border/80 bg-panel p-4">{toc}</div>
        </aside>
      ) : null}
      <div className="min-w-0 overflow-hidden">
        {shouldShowTableOfContents ? (
          <div className="mb-4 grid gap-3 xl:hidden">
            <Button
              aria-expanded={mobileTocOpen}
              onClick={() => {
                setMobileTocOpen((open) => !open);
              }}
              type="button"
              variant="secondary"
            >
              {mobileTocOpen ? "Hide On This Page" : "On This Page"}
            </Button>
            {mobileTocOpen ? (
              <div className="border border-border/80 bg-panel p-4">{toc}</div>
            ) : null}
          </div>
        ) : null}
        <div className="qb-markdown">
          <ReactMarkdown
            components={{
              a: ({ children, href }) => {
                const target = toDocsHref(href ?? "");

                if (target.startsWith("#")) {
                  return (
                    <a
                      className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
                      href={target}
                    >
                      {children}
                    </a>
                  );
                }

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
                <blockquote className="overflow-hidden border-l-2 border-accent/60 pl-4 text-secondary">
                  {children}
                </blockquote>
              ),
              code: ({ children, className }) => {
                if (className) {
                  return (
                    <code className="block max-w-full overflow-x-auto border border-border/80 bg-panel-inset p-4 font-mono text-sm text-foreground">
                      {children}
                    </code>
                  );
                }

                return <code className={`${inlineCodeClassName} break-words`}>{children}</code>;
              },
              h1: ({ children }) => (
                <h1 className="break-words font-display text-[1.9rem] font-semibold tracking-[-0.02em]">
                  {children}
                </h1>
              ),
              h2: ({ children }) => {
                const id = getHeadingId(2, children);

                return (
                  <h2
                    className="mt-6 break-words border-t border-border/80 pt-4 font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground"
                    id={id}
                  >
                    {children}
                  </h2>
                );
              },
              h3: ({ children }) => {
                const id = getHeadingId(3, children);

                return (
                  <h3 className="mt-4 break-words text-lg font-semibold text-foreground" id={id}>
                    {children}
                  </h3>
                );
              },
              hr: () => <hr className="border-border/80" />,
              li: ({ children }) => <li className="break-words pl-1 leading-6 text-foreground">{children}</li>,
              ol: ({ children }) => <ol className="ml-7 list-decimal space-y-1.5 pl-4">{children}</ol>,
              p: ({ children }) => <p className="break-words leading-6">{children}</p>,
              pre: ({ children }) => (
                <pre className="my-4 max-w-full overflow-x-auto">{children as ReactNode}</pre>
              ),
              table: ({ children }) => (
                <div className="my-4 max-w-full overflow-x-auto border border-border/80">
                  <table className="min-w-full divide-y divide-border/80">{children}</table>
                </div>
              ),
              tbody: ({ children }) => <tbody className="divide-y divide-border/70">{children}</tbody>,
              td: ({ children }) => (
                <td className="break-words px-3 py-2 align-top text-sm text-secondary">{children}</td>
              ),
              th: ({ children }) => (
                <th className="bg-panel-inset px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {children}
                </th>
              ),
              thead: ({ children }) => <thead>{children}</thead>,
              tr: ({ children }) => <tr className="bg-panel">{children}</tr>,
              ul: ({ children }) => <ul className="ml-7 list-disc space-y-1.5 pl-4">{children}</ul>,
            }}
            remarkPlugins={[remarkGfm]}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
