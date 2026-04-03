import { useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildImplementationTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useProjectQuery } from "../hooks/use-projects.js";
import {
  useBuildContextPackMutation,
  useContextPacksQuery,
  useMemoryChunksQuery,
} from "../hooks/use-sandbox.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

export const DevelopContextPacksDebugPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const contextPacksQuery = useContextPacksQuery(id);
  const memoryQuery = useMemoryChunksQuery(id);
  const buildContextPackMutation = useBuildContextPackMutation(id);

  useSseEvents(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  return (
    <ProjectPageFrame
      activeSection="implementation"
      project={projectQuery.data}
      tertiaryItems={buildImplementationTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Implementation"
        title="Context Debug"
        summary="Inspect persisted memory chunks and immutable planning or coding context packs used by sandbox execution."
        meta={
          <>
            <Badge tone="neutral">{contextPacksQuery.data?.packs.length ?? 0} packs</Badge>
            <Badge tone="neutral">{memoryQuery.data?.chunks.length ?? 0} memory chunks</Badge>
          </>
        }
      />

      {contextPacksQuery.error || memoryQuery.error ? (
        <Alert tone="error">
          Failed to load sandbox memory or context packs. Retry after the API finishes refreshing.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card surface="panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="qb-meta-label">Context Packs</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                Stored pack snapshots
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={buildContextPackMutation.isPending}
                onClick={() => buildContextPackMutation.mutate({ type: "planning" })}
                variant="secondary"
              >
                Build planning
              </Button>
              <Button
                disabled={buildContextPackMutation.isPending}
                onClick={() => buildContextPackMutation.mutate({ type: "coding" })}
                variant="secondary"
              >
                Build coding
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {contextPacksQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : (contextPacksQuery.data?.packs.length ?? 0) === 0 ? (
              <p className="text-sm text-secondary">
                No context packs have been persisted for this project yet.
              </p>
            ) : (
              (contextPacksQuery.data?.packs ?? []).map((pack) => (
                <div key={pack.id} className="border border-border/70 bg-panel-inset p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{pack.summary}</p>
                    <div className="flex gap-2">
                      <Badge tone="neutral">v{pack.version}</Badge>
                      <Badge tone={pack.stale ? "warning" : "success"}>
                        {pack.stale ? "stale" : "fresh"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-secondary">
                    Coverage: {pack.sourceCoverage.join(", ") || "none"}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    Omissions: {pack.omissionList.join(", ") || "none"}
                  </p>
                  <pre className="mt-3 max-h-56 overflow-auto border border-border/70 bg-background/70 p-3 text-xs text-secondary">
                    {pack.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card surface="panel">
          <p className="qb-meta-label">Memory</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Repository memory chunks</p>
          <div className="mt-4 grid gap-3">
            {memoryQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : (memoryQuery.data?.chunks.length ?? 0) === 0 ? (
              <p className="text-sm text-secondary">
                No repository memory chunks are available yet. Build a context pack to seed them.
              </p>
            ) : (
              (memoryQuery.data?.chunks ?? []).map((chunk) => (
                <div key={chunk.id} className="border border-border/70 bg-panel-inset p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{chunk.key}</p>
                    <Badge tone="neutral">{chunk.sourceType}</Badge>
                  </div>
                  <pre className="mt-3 max-h-56 overflow-auto border border-border/70 bg-background/70 p-3 text-xs text-secondary">
                    {chunk.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </ProjectPageFrame>
  );
};
