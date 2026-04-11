import type { QuestionnaireAnswers } from "@quayboard/shared";

import { qualityCharter, renderQuestionnaireContext, renderQuestionnaireDefinition } from "./shared.js";

export const buildQuestionnaireAutoAnswerPrompt = (input: {
  projectDescription: string | null;
  projectName: string;
  answers: QuestionnaireAnswers["answers"];
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Fill only the blank questionnaire answers for "${input.projectName}".`,
    "Return valid JSON as an object that uses only the official questionnaire keys.",
    "Only include keys that are currently blank. Do not rewrite or repeat existing answers.",
    "Each returned value must be a non-empty string.",
    "Do not wrap the JSON in code fences.",
    "",
    "Project description:",
    input.projectDescription?.trim() || "(none saved yet)",
    "",
    "Questionnaire definition:",
    renderQuestionnaireDefinition(),
    "",
    "Existing questionnaire answers:",
    renderQuestionnaireContext(input.answers),
  ].join("\n");

export const buildProjectOverviewPrompt = (input: {
  projectDescription: string | null;
  projectName: string;
  answers: QuestionnaireAnswers["answers"];
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Shape a focused product overview that commits to a clear product direction for "${input.projectName}".`,
    "Return valid JSON with exactly three top-level string keys: \"title\", \"description\", and \"markdown\".",
    "The description should be a concise paragraph suitable for the project header and project list surfaces.",
    "The markdown should read like a polished planning document that commits to a product direction — not a questionnaire recap, a list of options, or a hedge-filled summary.",
    "Synthesize the questionnaire into a committed product direction. Where the questionnaire is silent on product shape, experience model, or user model — make a design decision and own it. Do not present alternatives or hedge.",
    "Do not mirror the questionnaire ordering or quote answers back line-by-line.",
    "Use these section headings in this exact order: Product Summary, Users and Roles, Problem and Opportunity, Product Vision, Core Workflows, Key Capabilities, Constraints and Non-Goals, Experience and Product Feel, Success Measures, Assumptions and Proposed Defaults.",
    "Product Vision must state a clear design thesis — what this product is and how it creates value. Core Workflows must describe specific interaction sequences, not generic step placeholders.",
    "Make the writing concrete, creative, and product-quality. Avoid generic software-product filler.",
    "Stated requirements take priority over inferred scope. The core product direction, paradigm, and user model may be committed to throughout the document even when inferred from context. Reserve the Assumptions and Proposed Defaults section for specific capabilities or features that extend beyond the stated requirements, and for choices that later planning jobs will need to make concrete as the design progresses.",
    "Do not make specific technology, framework, vendor, or implementation decisions — those belong in later planning stages.",
    "Do not add platform capabilities (offline support, push notifications, real-time sync, PWA installability) unless the source material explicitly requires them.",
    "Do not wrap the JSON in code fences.",
    "",
    "Current project description:",
    input.projectDescription?.trim() || "(none saved yet)",
    "",
    "Questionnaire definition:",
    renderQuestionnaireDefinition(),
    "",
    "Questionnaire answers:",
    renderQuestionnaireContext(input.answers),
  ].join("\n");
