import { questionnaireDefinition } from "@quayboard/shared";

import type { QuestionnaireAnswers } from "@quayboard/shared";
import type { ProjectSizeProfile } from "../../project-sizer.js";

export const qualityCharter = [
  "You are a senior product strategist and UX writer helping shape a high-quality software product.",
  "Be professional, creative, and specific.",
  "Think about strong comparable products and interaction patterns for inspiration, but do not copy or name-drop them unless the source material already does.",
  "Avoid generic startup filler, vague claims, empty buzzwords, and repetitive phrasing.",
  "Do not hyper-focus on one answer or signal. Synthesize the full context into a broad, well-balanced output.",
  "Prefer concrete user value, realistic workflows, credible differentiation, and thoughtful scope boundaries.",
].join("\n");

export const renderQuestionnaireContext = (answers: QuestionnaireAnswers["answers"]) =>
  JSON.stringify(answers, null, 2);

export const renderProjectScaleGuidance = (profile: ProjectSizeProfile): string => {
  const lines: string[] = ["## Project Scale and Proportionality"];

  if (profile.tier === "small") {
    lines.push(
      "This is a small-scope project. Scale the specification and planning proportionally:",
      "- Aim for 5–12 core features total. Do not enumerate enterprise subsystems or platform infrastructure.",
      "- Skip sections that genuinely do not apply (progression curves, economy models, simulation rules, game loops, multi-tenant architecture).",
      "- The feature inventory must list real product capabilities, not implementation layers or scaffolding steps.",
      "- If the feature set is thin after removing padding, that is correct — do not add placeholder or aspirational features to fill space.",
      "- Prefer vertical slices that deliver user value over horizontal platform layers.",
    );
  } else if (profile.tier === "medium") {
    lines.push(
      "This is a medium-scope project. Aim for 12–20 core features with full section coverage where applicable.",
      "- Include all sections relevant to the product type. Skip sections that genuinely do not apply.",
      "- Prefer vertical slices over exhaustive system inventories.",
    );
  } else {
    lines.push(
      "This is a large-scope project. Aim for comprehensive coverage across all relevant sections.",
      "- Include full system and component inventories, subsystem breakdowns, and cross-cutting concerns.",
    );
  }

  if (profile.techStackHint) {
    lines.push(
      "",
      "## Tech Stack",
      `The stated or inferred tech stack is: ${profile.techStackHint}.`,
      "Do not propose platform migration, language change, or framework replacement unless the source material explicitly requires it.",
      "When generating features, tasks, or technical guidance, stay within the established tech stack.",
    );
  }

  return lines.join("\n");
};

export const renderMilestoneScaffoldingGuidance = (profile: ProjectSizeProfile): string => {
  if (profile.tier === "small") {
    return (
      "The first milestone should bootstrap only what is needed to start delivering: " +
      "repo setup, minimal CI, and a first working capability. " +
      "Do not require full ADR scaffolding, documentation structure, or a comprehensive test harness for a small utility."
    );
  }
  if (profile.tier === "medium") {
    return (
      "The first milestone should include essential delivery scaffolding " +
      "(CI, folder structure, baseline docs) plus a meaningful first delivery slice."
    );
  }
  return (
    "The first milestone must be a foundations/setup milestone covering repository and delivery scaffolding " +
    "such as AGENTS.md, initial folder structure, baseline docs/ADR scaffolding, environment/bootstrap setup, " +
    "CI/test harness, and a minimal smoke-path or hello-world slice."
  );
};

export const renderFeatureBudgetGuidance = (profile: ProjectSizeProfile): string => {
  if (profile.tier === "large") return "";
  return (
    `Feature count guidance: For a project of this scope, aim for ${profile.featureBudgetPerMilestone} features per milestone. ` +
    "Prefer complete vertical slices over granular system shards. " +
    "If the milestone is thin after covering real user value, that is correct — do not add placeholder features."
  );
};

export const renderQuestionnaireDefinition = () =>
  JSON.stringify(
    questionnaireDefinition.map((question) => ({
      helpText: question.helpText,
      key: question.key,
      prompt: question.prompt,
      title: question.title,
    })),
    null,
    2,
  );

export const renderFeatureContext = (input: {
  acceptanceCriteria: string[];
  featureKey: string;
  milestoneTitle: string;
  summary: string;
  title: string;
}) =>
  JSON.stringify(
    {
      acceptanceCriteria: input.acceptanceCriteria,
      featureKey: input.featureKey,
      milestoneTitle: input.milestoneTitle,
      summary: input.summary,
      title: input.title,
    },
    null,
    2,
  );

export const renderSiblingFeatures = (
  siblings: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>,
) => JSON.stringify(siblings, null, 2);

export const renderRepairHint = (hint?: string | null) =>
  hint?.trim() ? ["Repair objective:", hint.trim(), ""] : [];
