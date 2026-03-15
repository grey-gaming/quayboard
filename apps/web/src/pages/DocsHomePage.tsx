import { Link } from "react-router-dom";

import { MarkdownDocument } from "../components/composites/MarkdownDocument.js";
import { DocsFrame } from "../components/templates/DocsFrame.js";
import { Card } from "../components/ui/Card.js";
import { docsGuideEntries, docsLandingEntry } from "../lib/docs-content.js";

export const DocsHomePage = () => (
  <DocsFrame activeSlug="" guides={docsGuideEntries}>
    <MarkdownDocument markdown={docsLandingEntry.markdown} />
    <section className="space-y-4">
      <h2 className="font-display text-2xl tracking-tight">Available Guides</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {docsGuideEntries.map((guide) => (
          <Link key={guide.slug} to={`/docs/${guide.slug}`}>
            <Card className="h-full hover:border-accent/35 hover:bg-panel/88" surface="panel">
              <p className="font-semibold tracking-tight">{guide.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {guide.summary ?? "Open this guide to read the full walkthrough."}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  </DocsFrame>
);
