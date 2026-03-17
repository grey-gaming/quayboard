import { Link, useParams } from "react-router-dom";

import { MarkdownDocument } from "../components/composites/MarkdownDocument.js";
import { DocsFrame } from "../components/templates/DocsFrame.js";
import { Card } from "../components/ui/Card.js";
import { docsGuideEntries, getDocsEntry } from "../lib/docs-content.js";

export const DocsArticlePage = () => {
  const { slug = "" } = useParams();
  const entry = getDocsEntry(slug);

  return (
    <DocsFrame activeSlug={slug} guides={docsGuideEntries}>
      {entry ? (
        <MarkdownDocument markdown={entry.markdown} />
      ) : (
        <Card surface="rail">
          <p className="font-display text-2xl font-semibold tracking-[-0.02em]">Guide not found</p>
          <p className="mt-3 text-sm text-secondary">
            The requested guide does not exist. Return to the documentation index or open one of
            the available guides from the sidebar.
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover"
            to="/docs"
          >
            Back to docs home
          </Link>
        </Card>
      )}
    </DocsFrame>
  );
};
