import type { FeatureGraphResponse } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";
import { Card } from "../ui/Card.js";

export const FeatureDependencyGraph = ({
  graph,
}: {
  graph: FeatureGraphResponse;
}) => {
  const dependenciesByFeatureId = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const existing = dependenciesByFeatureId.get(edge.featureId) ?? [];
    existing.push(edge.dependsOnFeatureId);
    dependenciesByFeatureId.set(edge.featureId, existing);
  }

  const titleByFeatureId = new Map(graph.nodes.map((node) => [node.featureId, node.title]));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {graph.nodes.map((node) => (
        <Card key={node.featureId} surface="inset">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="qb-meta-label">{node.featureKey}</p>
              <p className="mt-1 font-semibold tracking-[-0.02em]">{node.title}</p>
            </div>
            <Badge tone="neutral">{node.kind.replaceAll("_", " ")}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral">{node.milestoneTitle}</Badge>
            <Badge tone="neutral">{node.priority.replaceAll("_", " ")}</Badge>
            <Badge tone={node.status === "completed" ? "success" : "info"}>
              {node.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <div className="mt-4 border-t border-border/70 pt-3 text-sm text-secondary">
            <p className="qb-meta-label">Depends on</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(dependenciesByFeatureId.get(node.featureId) ?? []).length === 0 ? (
                <span>No dependencies</span>
              ) : (
                (dependenciesByFeatureId.get(node.featureId) ?? []).map((dependencyId) => (
                  <Badge key={dependencyId} tone="warning">
                    {titleByFeatureId.get(dependencyId) ?? dependencyId}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </Card>
      ))}
      {graph.nodes.length === 0 ? (
        <Card surface="inset">
          <p className="text-sm text-secondary">Add features to render the dependency graph.</p>
        </Card>
      ) : null}
    </div>
  );
};
