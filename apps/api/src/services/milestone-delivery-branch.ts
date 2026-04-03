type OrderedFeature = {
  dependencyIds: string[];
  featureKey: string;
  id: string;
};

const compareByFeatureKey = <T extends { featureKey: string }>(left: T, right: T) =>
  left.featureKey.localeCompare(right.featureKey);

export const orderMilestoneFeatures = <T extends OrderedFeature>(features: T[]) => {
  const featureIds = new Set(features.map((feature) => feature.id));
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const indegree = new Map<string, number>();
  const dependentsById = new Map<string, string[]>();

  for (const feature of features) {
    indegree.set(feature.id, 0);
    dependentsById.set(feature.id, []);
  }

  for (const feature of features) {
    const milestoneDependencies = feature.dependencyIds.filter((dependencyId) =>
      featureIds.has(dependencyId),
    );

    indegree.set(feature.id, milestoneDependencies.length);

    for (const dependencyId of milestoneDependencies) {
      dependentsById.get(dependencyId)?.push(feature.id);
    }
  }

  const ready = features
    .filter((feature) => (indegree.get(feature.id) ?? 0) === 0)
    .sort(compareByFeatureKey);
  const ordered: T[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) {
      break;
    }

    ordered.push(current);

    const dependents = (dependentsById.get(current.id) ?? [])
      .map((dependentId) => byId.get(dependentId))
      .filter((feature): feature is T => Boolean(feature))
      .sort(compareByFeatureKey);

    for (const dependent of dependents) {
      const nextIndegree = Math.max(0, (indegree.get(dependent.id) ?? 0) - 1);
      indegree.set(dependent.id, nextIndegree);

      if (nextIndegree === 0) {
        ready.push(dependent);
        ready.sort(compareByFeatureKey);
      }
    }
  }

  if (ordered.length === features.length) {
    return ordered;
  }

  const remaining = features
    .filter((feature) => !ordered.some((entry) => entry.id === feature.id))
    .sort(compareByFeatureKey);

  return [...ordered, ...remaining];
};

export const buildMilestoneDeliveryBranchName = (milestone: {
  id: string;
  position: number;
}) => `quayboard/m-${milestone.position.toString().padStart(3, "0")}/${milestone.id.slice(0, 8)}`;

export const buildPostMergeFixBranchName = (featureKey: string, runId: string) =>
  `quayboard/fix/${featureKey.toLowerCase()}/${runId.slice(0, 8)}`;
