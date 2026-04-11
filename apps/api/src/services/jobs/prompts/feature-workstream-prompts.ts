import { qualityCharter, renderFeatureContext, renderRepairHint, renderSiblingFeatures } from "./shared.js";

export const buildFeatureProductSpecPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  productSpec: string;
  technicalSpec: string;
  uxSpec: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    "Generate a feature-scoped Product Spec from the approved project Product Spec, UX Spec, and Technical Spec.",
    "Return valid JSON with top-level keys: \"title\", \"markdown\", and \"requirements\".",
    "The markdown must be detailed, implementation-oriented, and scoped only to the feature described below.",
    "The requirements object must contain boolean keys: uxRequired, techRequired, userDocsRequired, archDocsRequired.",
    "Use the milestone design doc and sibling feature list to keep ownership boundaries clear. Do not narrow the feature into a task-sized slice or expand it into neighboring feature scope.",
    "If this feature's title contains structural terms such as 'Foundation', 'Core', 'Shell', 'Scaffold', 'Bootstrap', or 'Setup', describe only the minimum owned capability required to support the milestone. Defer cross-cutting concerns such as offline handling, real-time sync, notification integration, or sibling-feature entry points unless the milestone design document explicitly places them here.",
    "Specify the primary success path in full before describing secondary branches, error states, or optional variants.",
    "Write as a committed product authority for this feature. Make product decisions and own them — do not hedge, present alternatives, or mark inferences as uncertain within the main spec body.",
    "Where you extend into proposed technical approaches, optional implementation variants, or non-obvious design choices beyond what the acceptance criteria and project specs confirm, place those in an 'Assumptions and Proposed Defaults' section at the end. Do not embed them in the main spec body as confirmed requirements.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Product Spec:",
    input.productSpec,
    "",
    "Approved project UX Spec:",
    input.uxSpec,
    "",
    "Approved project Technical Spec:",
    input.technicalSpec,
  ].join("\n");

export const buildFeatureProductSpecReviewPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  draftTitle: string;
  draftMarkdown: string;
  requirements: {
    uxRequired: boolean;
    techRequired: boolean;
    userDocsRequired: boolean;
    archDocsRequired: boolean;
  };
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the feature Product Spec for "${input.feature.title}".`,
    'Return valid JSON with top-level keys: "title", "markdown", and "requirements".',
    "Preserve the intended feature scope while improving coverage, ownership boundaries, and consistency with the milestone design.",
    "Do not let the reviewed draft collapse into task-sized work or bleed into sibling features.",
    "- ensure proposed technical approaches and non-obvious implementation choices are in an 'Assumptions and Proposed Defaults' section rather than embedded in the main spec body as confirmed requirements; the main spec should read as committed feature product direction",
    "- where the draft hedges or uses uncertain language ('might', 'could', 'possibly') for core feature capabilities, convert those to committed statements or move them to Assumptions and Proposed Defaults",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "First-pass feature Product Spec title:",
    input.draftTitle,
    "",
    "First-pass feature Product Spec markdown:",
    input.draftMarkdown,
    "",
    "First-pass feature Product Spec requirements:",
    JSON.stringify(input.requirements, null, 2),
  ].join("\n");

export const buildFeatureUxSpecPrompt = (input: {
  featureProductSpec: string;
  featureTitle: string;
  milestoneDesignDoc: string;
  projectProductSpec: string;
  projectUxSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the feature-scoped UX Spec for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Use the approved feature Product Spec as the main scope definition and the approved project UX Spec as the UX-system reference.",
    "Use the milestone design doc and sibling feature summaries to avoid drifting into neighboring feature scope.",
    "Focus exclusively on interaction design, layout, state transitions, copy, and accessibility decisions that are not already resolved in the feature Product Spec.",
    "Write as a committed UX authority for this feature. Make interaction and visual design decisions and own them — do not hedge or present alternatives within the main spec body.",
    "Where you extend into specific component implementations, animation timings, or detailed layout choices not confirmed in the project UX Spec, place those in an 'Assumptions and Proposed Defaults' section at the end.",
    "Do not re-state product behavior, data models, API contracts, sync protocols, or backend rules already settled upstream. If a decision is already made in the Product Spec, reference it briefly rather than restating it at length.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
  ].join("\n");

export const buildFeatureTechSpecPrompt = (input: {
  featureProductSpec: string;
  featureTitle: string;
  milestoneDesignDoc: string;
  projectProductSpec: string;
  projectTechnicalSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the feature-scoped Technical Spec for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Use the approved feature Product Spec as the main scope definition and the approved project Technical Spec as the technical-system reference.",
    "Use the milestone design doc and sibling feature summaries to keep the implementation boundary clear.",
    "Focus exclusively on implementation decisions, data contracts, interface definitions, persistence requirements, and technical constraints that are not already resolved in the feature Product Spec.",
    "Write as a committed technical authority for this feature. Own the architectural approach, data model, and technical constraints.",
    "Where you define specific API endpoint paths, request/response schemas, third-party vendor choices, or library versions not confirmed in the project Technical Spec, place those in an 'Assumptions and Proposed Defaults' section at the end — do not embed them in the main body as if they are confirmed contracts.",
    "Do not re-state product behavior or UX decisions already settled upstream. If a decision is already made, reference it briefly rather than restating it at length.",
    "Do not include monitoring plans, rollout strategies, post-MVP roadmaps, enhancement ideas, or operational procedures unless they are directly required for the current feature implementation.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
  ].join("\n");

export const buildFeatureUserDocsPrompt = (input: {
  featureProductSpec: string;
  featureTitle: string;
  milestoneDesignDoc: string;
  projectProductSpec: string;
  projectUxSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate user-facing documentation for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Focus on user-facing behavior, setup expectations, and walkthrough guidance rather than implementation details.",
    "Write user documentation as committed feature behavior. Describe what the feature does and how users interact with it based on the Product Spec direction. Do not hedge; document the designed behavior as authoritative guidance.",
    "Keep documentation ownership aligned to this feature only. If related documentation belongs to a sibling feature, do not absorb it here.",
    "Document only stable, user-visible behavior that the product is ready to support publicly. Do not document implementation details, cryptographic specifics, backend timing guarantees, offline queueing mechanics, or speculative roadmap language.",
    "Do not describe sibling or future features unless they are already approved and directly required for a user to understand this feature.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
  ].join("\n");

export const buildFeatureArchDocsPrompt = (input: {
  featureTechSpec: string | null;
  featureTitle: string;
  milestoneDesignDoc: string;
  projectTechnicalSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate internal architecture documentation for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Focus on component boundaries, state ownership, interface contracts, data flow, and non-negotiable constraints that other engineers working in this area need to know.",
    "Write as a committed architectural authority for this feature. Own the component design, state ownership, and data flow decisions.",
    "Where you prescribe specific interface contracts, data schemas, or integration protocols not confirmed in the project Technical Spec or feature Tech Spec, place those in an 'Assumptions and Proposed Defaults' section at the end — do not embed them in the main body as settled architecture.",
    "Keep the document scoped to this feature's owned architecture. Use the milestone design doc and sibling feature summaries to avoid duplicating another feature's architecture notes.",
    "Do not include speculative extension points, future considerations, observability planning, or operational rollout detail unless explicitly required by the upstream specs.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    ...(input.featureTechSpec
      ? ["Approved feature Technical Spec:", input.featureTechSpec, ""]
      : []),
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
  ].join("\n");

export const buildFeatureWorkstreamReviewPrompt = (input: {
  workstreamLabel: string;
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  draftTitle: string;
  draftMarkdown: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the ${input.workstreamLabel} for "${input.feature.title}".`,
    'Return valid JSON with non-empty "title" and "markdown" keys.',
    "Preserve the same feature scope while improving completeness, consistency, and ownership boundaries.",
    "Do not widen the scope into sibling features and do not collapse it into a task-sized fragment.",
    "If the draft re-states behavior already settled in the upstream feature Product Spec without adding discipline-specific decisions, revise it to focus only on what this workstream uniquely contributes.",
    "- ensure proposed technical approaches, specific contracts, and non-obvious implementation choices are in an 'Assumptions and Proposed Defaults' section rather than embedded in the main body as confirmed decisions; the main spec should read as committed workstream direction",
    "- where the draft hedges or uses uncertain language ('might', 'could', 'possibly') for core workstream decisions, convert those to committed statements or move them to Assumptions and Proposed Defaults",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    `First-pass ${input.workstreamLabel} title:`,
    input.draftTitle,
    "",
    `First-pass ${input.workstreamLabel} markdown:`,
    input.draftMarkdown,
  ].join("\n");
