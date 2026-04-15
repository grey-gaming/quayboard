import { qualityCharter } from "./shared.js";

export const buildMilestoneCoverageReviewPrompt = (input: {
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  features: Array<{
    acceptanceCriteria: string[];
    featureKey: string;
    workstreams: {
      product: "approved" | "missing" | "draft";
      ux: "approved" | "missing" | "draft";
      tech: "approved" | "missing" | "draft";
      userDocs: "approved" | "missing" | "draft";
      archDocs: "approved" | "missing" | "draft";
    };
    workstreamDocs?: {
      product: string | null;
      ux: string | null;
      tech: string | null;
      userDocs: string | null;
      archDocs: string | null;
    };
    title: string;
    summary: string;
    taskCount: number;
    taskTitles: string[];
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review whether the planned work fully covers milestone "${input.milestone.title}".`,
    'Return valid JSON with exactly three keys: "complete" (boolean), "milestoneId" (string placeholder ignored by the prompt consumer), and "issues" (array).',
    'Each issue must be an object with exactly two keys: "action" and "hint".',
    '"action" must be either "rewrite_feature_set" or "needs_human_review".',
    "Only report material coverage gaps between the milestone design doc and the current feature/task plan.",
    "Be conservative. Do not report minor wording differences or implied detail that is already covered.",
    'Use "rewrite_feature_set" when the current milestone feature boundaries need to be rewritten to resolve the gap cleanly.',
    'Use "needs_human_review" when the gap is ambiguous, structural, or likely requires manual milestone or design changes.',
    'If the milestone design doc itself is coherent and the gap can be fixed by rewriting or expanding features, prefer "rewrite_feature_set".',
    'Use "needs_human_review" only when the milestone design doc still contains an unresolved contradiction or missing decision that prevents one consistent in-scope feature set.',
    "If coverage is complete, return complete=true and an empty issues array.",
    "Do not wrap the JSON in code fences.",
    "",
    "Milestone summary:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Canonical milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Current milestone features, approved workstream document text, and task titles:",
    JSON.stringify(input.features, null, 2),
  ].join("\n");

export const buildRewriteMilestoneFeatureSetPrompt = (input: {
  issues: Array<{
    action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
    hint: string;
  }>;
  attemptNumber: number;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  currentMilestoneFeatures: Array<{
    title: string;
    summary: string;
  }>;
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  overviewDocument: string;
  projectName: string;
  projectProductSpec: string;
  projectTechnicalSpec: string;
  projectUxSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Rewrite the full feature set for milestone "${input.milestone.title}" in "${input.projectName}" so it cleanly resolves the surfaced milestone coverage gap.`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "IMPORTANT: kind MUST be exactly one of these values with no variation: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "The output is the full replacement feature set for this milestone, not just the incremental fix.",
    "Rewrite sibling boundaries as needed so cross-feature interaction issues are handled inside the feature set itself.",
    "Prefer fewer, coherent feature-sized items over task-sized fragments.",
    "Resolve the named issues into one consistent ownership model across all features; do not restate the ambiguity in the rewritten set.",
    "Choose one conservative default for shared resource control, ordering heuristics, and platform/API constraints when that default can satisfy the milestone design document.",
    "Treat the milestone design document's Included User Flows and Delivery Shape groupings as hard constraints while rewriting.",
    "Each named flow step, screen, and responsibility in the milestone design document must belong to exactly one rewritten feature.",
    "Cover every delivery group named in the milestone design document, including state-management or service groups that do not own screens.",
    "Make the rewritten set collectively satisfy every milestone exit criterion. Every exit criterion in the milestone design document must map to at least one rewritten feature acceptance criterion.",
    "Treat partial coverage as incomplete. If a rendering group owns grid, snake, and food rendering, do not return a rewrite that covers only food rendering.",
    "Do not include rewritten acceptance criteria that depend on mechanics, collision checks, ordering rules, or behaviors listed as out of scope in the milestone design document.",
    "When the milestone design document resolves a risk or ambiguity, use that one interpretation consistently across the rewritten set.",
    "Keep the result scoped only to the selected milestone and avoid duplicating features from other milestones.",
    "Do not wrap the JSON in code fences.",
    "",
    "Coverage issues to close in this rewrite:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Approved overview document:",
    input.overviewDocument,
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
    "",
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Current milestone feature set to replace:",
    JSON.stringify(input.currentMilestoneFeatures, null, 2),
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
  ].join("\n");

export const buildRewriteMilestoneFeatureSetReviewPrompt = (input: {
  issues: Array<{
    action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
    hint: string;
  }>;
  attemptNumber: number;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  currentMilestoneFeatures: Array<{
    title: string;
    summary: string;
  }>;
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  draftFeatures: Array<{
    title: string;
    summary: string;
    acceptanceCriteria: string[];
    kind: string;
    priority: string;
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the rewritten feature set for milestone "${input.milestone.title}".`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Preserve the intended full-set rewrite, close the named gap cleanly, and keep sibling feature ownership clear.",
    "Ensure the final rewrite uses one consistent interpretation of the milestone design document's flow order, screen ownership, and Delivery Shape boundaries.",
    "Ensure shared resources, automation ownership, and ordering heuristics use one conservative default instead of preserving conflicting interpretations.",
    "Ensure the final rewrite covers every delivery group named in the milestone design document, including non-visual groups with no screens.",
    "Ensure the final rewrite collectively satisfies every milestone exit criterion from the milestone design document.",
    "Treat partial coverage as incomplete. If a rendering group owns grid, snake, and food rendering, do not approve a rewrite that covers only food rendering.",
    "Remove or rewrite any acceptance criterion that depends on out-of-scope mechanics, collision checks, ordering rules, or future-milestone behavior.",
    "Merge overlapping or task-sized items back into coherent features.",
    "Do not wrap the JSON in code fences.",
    "",
    "Coverage issues to close in this rewrite:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Current milestone feature set to replace:",
    JSON.stringify(input.currentMilestoneFeatures, null, 2),
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
    "",
    "First-pass rewritten feature set:",
    JSON.stringify(input.draftFeatures, null, 2),
  ].join("\n");


export const buildMilestoneCoverageRepairPrompt = (input: {
  issues: Array<{ action: "needs_human_review"; hint: string }>;
  attemptNumber: number;
  previousUnresolvedReasons?: string[];
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  features: Array<{
    featureKey: string;
    title: string;
    summary: string;
    acceptanceCriteria: string[];
    taskTitles: string[];
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Resolve the milestone coverage gaps for milestone "${input.milestone.title}" without editing the milestone design document itself.`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    'Return valid JSON with exactly four top-level keys: "resolved" (boolean), "defaultsChosen" (array), "operations" (array), and "unresolvedReasons" (array).',
    'Each defaultsChosen item must contain exactly: "issueIndex", "decision", "rationale".',
    'Each operations item must contain exactly: "featureKey", "featurePatch", "refresh", and "hint".',
    'featurePatch must be either null or an object with exactly: "title", "summary", "acceptanceCriteria".',
    'refresh must be an object with exactly these boolean keys: "product", "ux", "tech", "userDocs", "archDocs", "tasks".',
    "Use only existing features from the selected milestone. Do not add, remove, move, or merge features.",
    "Choose conservative defaults that satisfy the milestone design document and keep work inside the active milestone.",
    "Prefer resolving ambiguous shared-resource ownership, ordering heuristics, and platform/API constraints through concrete feature/workstream updates over returning unresolved.",
    "Examples: split user-controlled volume from automated dampening into separate GainNodes; pick one voice-stealing heuristic and refresh the affected feature acceptance criteria.",
    "If the gaps cannot be resolved with updates to existing feature definitions, workstreams, and tasks, return resolved=false and explain why in unresolvedReasons.",
    "Do not wrap the JSON in code fences.",
    "",
    `Valid featureKey values for operations (use ONLY these exact strings): ${JSON.stringify(input.features.map((f) => f.featureKey))}`,
    "",
    "Example of a valid operation:",
    JSON.stringify({
      featureKey: "F-001",
      featurePatch: { title: "Updated title", summary: "Updated summary", acceptanceCriteria: ["Criterion 1"] },
      refresh: { product: true, ux: false, tech: false, userDocs: false, archDocs: false, tasks: false },
      hint: "Expanded feature scope to cover missing authentication flow",
    }, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Canonical milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Coverage gaps to resolve:",
    JSON.stringify(input.issues, null, 2),
    "",
    ...(input.previousUnresolvedReasons?.length
      ? [
          "Previous unresolved reasons from the prior repair attempt:",
          JSON.stringify(input.previousUnresolvedReasons, null, 2),
          "",
        ]
      : []),
    "Current active-milestone features and task titles:",
    JSON.stringify(input.features, null, 2),
  ].join("\n");

export const buildMilestoneCoverageRepairReviewPrompt = (input: {
  milestone: {
    summary: string;
    title: string;
  };
  attemptNumber: number;
  milestoneDesignDoc: string;
  issues: Array<{ action: "needs_human_review"; hint: string }>;
  previousUnresolvedReasons?: string[];
  draftPlan: {
    resolved: boolean;
    defaultsChosen: Array<{
      issueIndex: number;
      decision: string;
      rationale: string;
    }>;
    operations: Array<{
      featureKey: string;
      featurePatch: {
        title: string;
        summary: string;
        acceptanceCriteria: string[];
      } | null;
      refresh: {
        product: boolean;
        ux: boolean;
        tech: boolean;
        userDocs: boolean;
        archDocs: boolean;
        tasks: boolean;
      };
      hint: string;
    }>;
    unresolvedReasons: string[];
  };
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the milestone coverage repair plan for milestone "${input.milestone.title}".`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    'Return valid JSON with exactly four top-level keys: "resolved", "defaultsChosen", "operations", and "unresolvedReasons".',
    "Keep the plan conservative, executable, and limited to existing active-milestone features.",
    "If the draft chooses a reasonable conservative default for a shared-resource or ordering conflict, preserve that choice and make sure the refresh plan updates every affected workstream/task.",
    "Do not invent milestone-document changes or cross-milestone work.",
    "If the draft plan is overreaching, reduce it or set resolved=false.",
    "Do not wrap the JSON in code fences.",
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Canonical milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Coverage gaps to resolve:",
    JSON.stringify(input.issues, null, 2),
    "",
    ...(input.previousUnresolvedReasons?.length
      ? [
          "Previous unresolved reasons from the prior repair attempt:",
          JSON.stringify(input.previousUnresolvedReasons, null, 2),
          "",
        ]
      : []),
    "First-pass repair plan:",
    JSON.stringify(input.draftPlan, null, 2),
  ].join("\n");
