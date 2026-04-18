import { qualityCharter, renderFeatureContext, renderRepairHint } from "./shared.js";

export const buildTaskClarificationsPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  planningDocuments: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate clarification questions for implementing "${input.feature.title}".`,
    "Return valid JSON as a non-empty array of objects.",
    "Each object must have a \"question\" key with a clear, specific question for the implementation.",
    "Each object may have an optional \"context\" key with additional context.",
    "Focus on ambiguous areas in the approved feature planning documents, acceptance criteria, or implementation approach.",
    "Ask only blocker-level questions that materially change implementation. Do not ask low-value polish questions or questions already answered clearly by the provided specs.",
    "Do not ask about things already decided at the milestone level — use the milestone design document as background context only.",
    "Ask about edge cases, error handling, integration points, and data model decisions.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature planning documents:",
    input.planningDocuments,
    "",
    "Milestone design document (wider context only — this feature is one part of a larger milestone, do not re-plan the milestone):",
    input.milestoneDesignDoc,
  ].join("\n");

export const buildAutoAnswerClarificationsPrompt = (input: {
  clarifications: Array<{ question: string; context?: string | null }>;
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  planningDocuments: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Answer clarification questions for implementing "${input.feature.title}".`,
    "Return valid JSON as an array of objects matching the input order.",
    "Each object must have an \"answer\" key with a helpful, implementation-focused answer.",
    "Derive answers from the approved feature planning documents, feature context, and standard software engineering practices.",
    "Use the milestone design document as background context to inform answers about integration points or architectural decisions already made at the milestone level.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature planning documents:",
    input.planningDocuments,
    "",
    "Milestone design document (wider context only — this feature is one part of a larger milestone, do not re-plan the milestone):",
    input.milestoneDesignDoc,
    "",
    "Clarification questions:",
    JSON.stringify(
      input.clarifications.map((c) => ({ question: c.question, context: c.context })),
      null,
      2,
    ),
  ].join("\n");

export const buildFeatureTaskListPrompt = (input: {
  clarifications: Array<{ question: string; answer: string }>;
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  planningDocuments: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate an ordered implementation task list for "${input.feature.title}".`,
    "Return valid JSON as a non-empty array of objects.",
    "Each object must have: \"title\", \"description\", \"instructions\" (optional), \"acceptanceCriteria\" (array).",
    "Apply clarification answers as constraints. They may narrow optional branches, but must not remove core product requirements confirmed by the approved planning documents.",
    "Order tasks in implementation sequence: setup, core logic, integration, testing.",
    "Prefer the smallest set of coherent implementation phases that can deliver this feature safely. Do not split the work into micro-tasks just because the steps are individually small.",
    "Merge tightly related coding, testing, and documentation work when they belong to the same implementation phase.",
    "Instructions should provide concrete guidance for how to implement.",
    "Ensure the full task list covers the feature acceptance criteria and any required testing, integration, migration, provider adapter, generated artifact, source data, persistence, or documentation work implied by the specs.",
    "If credentials, APIs, or external services are unavailable, plan a mockable adapter and visible production failure/blocker instead of fake success.",
    "Acceptance criteria must assert observable product truth, not just response shape. Do not let empty artifact references, canned generated output, or silent stubs satisfy production behavior.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature planning documents:",
    input.planningDocuments,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Clarification answers:",
    JSON.stringify(input.clarifications, null, 2),
  ].join("\n");

export const buildFeatureTaskListReviewPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  planningDocuments: string;
  draftTasks: Array<{
    title: string;
    description: string;
    instructions?: string | null;
    acceptanceCriteria: string[];
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the implementation task list for "${input.feature.title}".`,
    "Return valid JSON as a non-empty array of objects.",
    'Each object must have: "title", "description", "instructions" (optional), "acceptanceCriteria" (array).',
    "Review the full task list as a whole. Merge micro-tasks, restore missing coverage, and keep each task aligned to this feature's owned scope.",
    "The final task list should cover the feature acceptance criteria without spilling work into neighboring features.",
    "Restore missing provider adapters, generated artifacts, source data, persistence, integration boundaries, and visible production failure paths when they are required for the feature's claimed behavior.",
    "Reject empty artifact references, canned generated output, fake success, or silent production stubs as task completion criteria.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature planning documents:",
    input.planningDocuments,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "First-pass task list:",
    JSON.stringify(input.draftTasks, null, 2),
  ].join("\n");
