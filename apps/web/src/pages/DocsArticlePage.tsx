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
          <p className="font-display text-2xl tracking-tight">Guide not found</p>
          <p className="mt-3 text-sm text-muted-foreground">
            The requested guide does not exist. Return to the documentation index or open one of
            the available guides from the sidebar.
          </p>
          <Link
            className="mt-4 inline-flex text-sm font-semibold text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
            to="/docs"
          >
            Back to docs home
          </Link>
        </Card>
      )}
    </DocsFrame>
  );
};
