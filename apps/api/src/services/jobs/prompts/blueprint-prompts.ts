import { qualityCharter } from "./shared.js";

export const buildUserFlowPrompt = (input: {
  projectName: string;
  sourceMaterial: string;
  hint?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate a prioritised set of user flows for "${input.projectName}".`,
    'Return valid JSON as an array of objects with these keys: "title", "userStory", "entryPoint", "endState", "flowSteps", "coverageTags", "acceptanceCriteria", and "doneCriteriaRefs".',
    'Each "flowSteps" value must be an array of plain strings only. Do not return step objects, numbered objects, or nested structures.',
    "Describe each flow step in terms of what the user needs to accomplish, not which specific screen, button, or UI element they interact with. UI details belong in the UX design phase.",
    'Each "entryPoint" and "endState" must describe the user or system state (e.g. "User is not authenticated", "Order has been placed and confirmation is visible"), not a specific screen name or page.',
    'Each "acceptanceCriteria" entry must state an observable business outcome or user success condition — not a UI element, copy string, or screen layout.',
    "Cover the core product journey, key supporting paths, and critical failure states. Prefer well-specified flows over volume.",
    "Aim for the minimum set needed to inform milestone planning — typically 10 to 20 flows for a focused web or mobile app. Only exceed that range if the product genuinely requires more distinct journeys.",
    "Include the most important onboarding, happy-path, supporting, operational, and edge/failure journeys that are genuinely relevant to the product.",
    "Each flow must be specific, realistic, and distinct.",
    "Do not wrap the JSON in code fences.",
    ...(input.hint
      ? [
          "",
          "## Guidance",
          input.hint,
        ]
      : []),
    "",
    "Approved Product Spec:",
    input.sourceMaterial,
  ].join("\n");

export const buildDecisionDeckPrompt = (input: {
  kind: "tech" | "ux";
  productSpec: string;
  projectName: string;
  uxSpec?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the ${input.kind === "ux" ? "UX" : "technical"} decision tiles for "${input.projectName}".`,
    'Return valid JSON as an array of objects with these exact keys: "key", "category", "title", "prompt", "recommendation", and "alternatives".',
    'Each "recommendation" value must be an object with exactly "id", "label", and "description".',
    'Each "alternatives" value must be an array of at least two objects with exactly "id", "label", and "description".',
    input.kind === "ux"
      ? "Generate 5 to 8 UX decision tiles that capture the most important navigation, interaction, information architecture, content, and state choices needed before UX specification."
      : "Generate 5 to 8 technical decision tiles that capture the most important architecture, data, API, integration, and operational choices needed before technical specification.",
    "Each card must force a meaningful tradeoff rather than a cosmetic preference.",
    "Use short, stable kebab-case values for every option id and the card key.",
    "Do not set a user selection; the deck should present a recommendation and alternatives only.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    ...(input.uxSpec
      ? [
          "",
          "Approved UX Spec:",
          input.uxSpec,
        ]
      : []),
  ].join("\n");

export const buildDecisionConsistencyPrompt = (input: {
  productSpec: string;
  decisions: string;
  kind: "tech" | "ux";
  projectName: string;
  uxSpec?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Validate the selected ${input.kind === "ux" ? "UX" : "technical"} decisions for "${input.projectName}".`,
    'Return valid JSON with exactly two keys: "ok" (boolean) and "issues" (array of strings).',
    'Set "ok" to true only when the selected decisions form a coherent basis for specification generation.',
    "Be conservative. Report only hard blockers that would make the generated specification internally inconsistent or unable to cover required core scope.",
    "Hard blockers are limited to direct contradictions, missing required decisions for explicitly in-scope core flows/mechanics/surfaces, or gaps that cannot be resolved by documenting a reasonable default in the specification.",
    "Do not report non-critical, defaultable, or secondary gaps. If the specification can safely choose and document a sensible default without contradicting the approved specs, treat that as non-blocking.",
    "Do not block on secondary-device nuance, performance tuning detail, monetization detail, accessibility refinement, or future-facing implementation choices unless the approved specs make them mandatory for the current scope.",
    "Keep the issues array to the smallest set of high-confidence blockers.",
    "If the decisions are coherent, return an empty issues array.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    "",
    "Selected decisions:",
    input.decisions,
    ...(input.uxSpec
      ? [
          "",
          "Approved UX Spec:",
          input.uxSpec,
        ]
      : []),
  ].join("\n");

export const buildDecisionSelectionRepairPrompt = (input: {
  cards: Array<{
    id: string;
    key: string;
    title: string;
    recommendation: { id: string; label: string; description: string };
    alternatives: Array<{ id: string; label: string; description: string }>;
    selectedOptionId: string | null;
    customSelection: string | null;
  }>;
  currentSelections: string;
  issues: string[];
  kind: "tech" | "ux";
  productSpec: string;
  projectName: string;
  uxSpec?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Repair the selected ${input.kind === "ux" ? "UX" : "technical"} decisions for "${input.projectName}" so they become internally consistent with the approved specs.`,
    'Return valid JSON with exactly one top-level key: "patches".',
    'Each patches item must contain exactly: "cardId", "selectedOptionId", "customSelection", and "reason".',
    'Set exactly one of "selectedOptionId" or "customSelection" for each patch.',
    "Prefer existing option ids whenever possible.",
    "Use customSelection only when none of the listed options can satisfy the approved specs.",
    "Return the smallest set of patches needed to resolve the reported issues.",
    "Do not rewrite the decision cards themselves.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    ...(input.uxSpec
      ? [
          "",
          "Approved UX Spec:",
          input.uxSpec,
        ]
      : []),
    "",
    "Reported consistency issues:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Current selections:",
    input.currentSelections,
    "",
    "Available decision cards and options:",
    JSON.stringify(input.cards, null, 2),
  ].join("\n");

export const buildDecisionSelectionRepairReviewPrompt = (input: {
  cards: Array<{
    id: string;
    key: string;
    title: string;
    recommendation: { id: string; label: string; description: string };
    alternatives: Array<{ id: string; label: string; description: string }>;
    selectedOptionId: string | null;
    customSelection: string | null;
  }>;
  currentSelections: string;
  draftPlan: {
    patches: Array<{
      cardId: string;
      selectedOptionId: string | null;
      customSelection: string | null;
      reason: string;
    }>;
  };
  issues: string[];
  kind: "tech" | "ux";
  productSpec: string;
  projectName: string;
  uxSpec?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the ${input.kind === "ux" ? "UX" : "technical"} decision repair plan for "${input.projectName}".`,
    'Return valid JSON with exactly one top-level key: "patches".',
    'Each patches item must contain exactly: "cardId", "selectedOptionId", "customSelection", and "reason".',
    "Keep only the minimum valid changes needed to resolve the reported consistency issues.",
    "Prefer existing option ids whenever possible.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    ...(input.uxSpec
      ? [
          "",
          "Approved UX Spec:",
          input.uxSpec,
        ]
      : []),
    "",
    "Reported consistency issues:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Current selections:",
    input.currentSelections,
    "",
    "Available decision cards and options:",
    JSON.stringify(input.cards, null, 2),
    "",
    "Draft repair plan:",
    JSON.stringify(input.draftPlan, null, 2),
  ].join("\n");

export const buildProjectBlueprintPrompt = (input: {
  decisions: string;
  kind: "tech" | "ux";
  productSpec: string;
  projectName: string;
  uxSpec?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Create the ${input.kind === "ux" ? "UX" : "technical"} specification for "${input.projectName}".`,
    'Return valid JSON with exactly two top-level string keys: "title" and "markdown".',
    "The markdown must be a polished specification document suitable for later milestone and feature planning.",
    "Use the selected decisions as hard constraints.",
    "Explicitly document route or URL inventory, navigation labels, button and CTA labels, and relevant loading, empty, error, and success states where they apply.",
    "Do not wrap the JSON in code fences.",
    "",
    input.kind === "ux"
      ? "Use these exact markdown section headings in order: UX Spec Summary, Experience Principles, Information Architecture, Primary Journeys, Routes and Screens, Labels and Actions, Interaction Patterns and States, Risks and Open Questions."
      : "Use these exact markdown section headings in order: Technical Spec Summary, Architectural Principles, System Boundaries, Route and Surface Contracts, Data Model Direction, API and Integration Direction, Operational Concerns, Implementation Risks and Defaults.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    ...(input.uxSpec
      ? [
          "",
          "Approved UX Spec:",
          input.uxSpec,
        ]
      : []),
    "",
    "Selected decisions:",
    input.decisions,
  ].join("\n");
