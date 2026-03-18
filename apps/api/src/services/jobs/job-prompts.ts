import { questionnaireDefinition } from "@quayboard/shared";

import type { QuestionnaireAnswers } from "@quayboard/shared";

const qualityCharter = [
  "You are a senior product strategist and UX writer helping shape a high-quality software product.",
  "Be professional, creative, and specific.",
  "Think about strong comparable products and interaction patterns for inspiration, but do not copy or name-drop them unless the source material already does.",
  "Avoid generic startup filler, vague claims, empty buzzwords, and repetitive phrasing.",
  "Do not hyper-focus on one answer or signal. Synthesize the full context into a broad, well-balanced output.",
  "Prefer concrete user value, realistic workflows, credible differentiation, and thoughtful scope boundaries.",
].join("\n");

const renderQuestionnaireContext = (answers: QuestionnaireAnswers["answers"]) =>
  JSON.stringify(answers, null, 2);

const renderQuestionnaireDefinition = () =>
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

export const buildProjectDescriptionPrompt = (answers: QuestionnaireAnswers["answers"]) =>
  [
    qualityCharter,
    "",
    "Task:",
    "Write one concise paragraph that describes the product clearly and persuasively.",
    "The paragraph must feel specific to this project, capture the product's users and value, and stay grounded in the full questionnaire context.",
    "Do not use bullet points, headings, or JSON.",
    "",
    "Questionnaire answers:",
    renderQuestionnaireContext(answers),
  ].join("\n");

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
    `Create a detailed product preference document for "${input.projectName}".`,
    "Return valid JSON with exactly three top-level string keys: \"title\", \"description\", and \"markdown\".",
    "The description should be a concise paragraph suitable for the project header and project list surfaces.",
    "The markdown should read like a polished planning artifact, not a stitched questionnaire recap or a list of answered prompts.",
    "Synthesize the full context into a coherent product direction and fill reasonable gaps with explicit proposed defaults when the source material is incomplete.",
    "Do not mirror the questionnaire ordering or quote answers back line-by-line.",
    "Use these section headings in this exact order: Product Summary, Users and Roles, Problem and Opportunity, Product Vision, Core Workflows, Key Capabilities, Constraints and Non-Goals, Experience and Product Feel, Success Measures, Assumptions and Proposed Defaults.",
    "Make the writing concrete, creative, and product-quality. Avoid generic software-product filler and avoid narrowing the output to only what was stated explicitly.",
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

export const buildUserFlowPrompt = (input: {
  projectName: string;
  sourceMaterial: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate a broad first-pass set of user flows for "${input.projectName}".`,
    'Return valid JSON as an array of objects with these keys: "title", "userStory", "entryPoint", "endState", "flowSteps", "coverageTags", "acceptanceCriteria", and "doneCriteriaRefs".',
    "Produce a diverse and extensive set of flows, not slight variations of the same journey.",
    "Include the most important onboarding, happy-path, supporting, operational, and edge/failure journeys that are genuinely relevant to the product.",
    "Each flow must be specific, realistic, and distinct.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved overview or project context:",
    input.sourceMaterial,
  ].join("\n");
