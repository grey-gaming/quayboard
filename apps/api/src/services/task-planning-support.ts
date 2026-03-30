import type { FeatureTracksResponse } from "@quayboard/shared";

type FeatureTracks = FeatureTracksResponse["tracks"];

const taskPlanningTrackOrder = ["product", "ux", "tech", "userDocs", "archDocs"] as const;

const taskPlanningTrackLabels: Record<(typeof taskPlanningTrackOrder)[number], string> = {
  product: "Product Spec",
  ux: "UX Spec",
  tech: "Tech Spec",
  userDocs: "User Documentation",
  archDocs: "Architecture Documentation",
};

export const getMissingApprovedTaskPlanningTracks = (tracks: FeatureTracks) =>
  taskPlanningTrackOrder.filter((trackKey) => {
    const track = tracks[trackKey];
    return track.required && (!track.headRevision || track.status !== "approved");
  });

export const isTaskPlanningReady = (tracks: FeatureTracks) =>
  getMissingApprovedTaskPlanningTracks(tracks).length === 0;

export const buildTaskPlanningDocuments = (tracks: FeatureTracks) => {
  const sections = taskPlanningTrackOrder.flatMap((trackKey) => {
    const track = tracks[trackKey];

    if (!track.required || !track.headRevision || track.status !== "approved") {
      return [];
    }

    return [
      `Approved feature ${taskPlanningTrackLabels[trackKey]}:`,
      track.headRevision.markdown,
      "",
    ];
  });

  return sections.join("\n").trim();
};

export const buildTaskPlanningReadinessMessage = (tracks: FeatureTracks) => {
  const missingTrackLabels = getMissingApprovedTaskPlanningTracks(tracks).map(
    (trackKey) => taskPlanningTrackLabels[trackKey],
  );

  if (missingTrackLabels.length === 0) {
    return "Feature must have approved required planning documents.";
  }

  return `Feature must have approved required planning documents before task planning: ${missingTrackLabels.join(", ")}.`;
};
