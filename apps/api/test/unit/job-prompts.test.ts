import { describe, expect, it } from "vitest";

import {
  buildQuestionnaireAutoAnswerPrompt,
  buildProjectDescriptionPrompt,
  buildProjectOverviewPrompt,
  buildProductSpecPrompt,
  buildProductSpecReviewPrompt,
  buildUserFlowPrompt,
} from "../../src/services/jobs/job-prompts.js";

const sampleAnswers = {
  q1_name_and_description: "A workspace for planning agentic software delivery.",
  q2_who_is_it_for: "Engineering leads and delivery managers.",
  q3_problem_solved: "Teams need governed AI-assisted delivery workflows.",
  q4_success_looks_like: "Teams can go from idea to approved plan quickly.",
  q5_out_of_scope: "Direct production deployment.",
  q6_main_capabilities: "Setup, planning documents, approvals, and user flows.",
  q7_differentiator: "Governance and evidence are first-class.",
  q8_typical_usage_flow: "Create project, answer questions, review docs, approve flows.",
  q9_platform_and_access: "Browser-based control plane.",
  q10_first_user_next_step: "Create a project and finish setup.",
  q11_constraints_and_requirements: "PR-first workflow and clear audit trail.",
  q12_design_references: "Linear and GitHub Projects.",
  q13_tech_constraints: "Monorepo with Fastify and React.",
  q14_product_feel: "Professional, intentional, and calm.",
};

describe("job prompts", () => {
  it("adds the shared quality framing to the description prompt", () => {
    const prompt = buildProjectDescriptionPrompt(sampleAnswers);

    expect(prompt).toContain("senior product strategist and UX writer");
    expect(prompt).toContain("Be professional, creative, and specific.");
    expect(prompt).toContain("Do not hyper-focus on one answer or signal.");
    expect(prompt).toContain("one concise paragraph");
    expect(prompt).toContain('"q1_name_and_description"');
  });

  it("preserves the overview JSON contract while generating a richer preference document", () => {
    const prompt = buildProjectOverviewPrompt({
      projectDescription: "Governed planning workspace for software teams.",
      projectName: "Quayboard",
      answers: sampleAnswers,
    });

    expect(prompt).toContain(
      'exactly three top-level string keys: "title", "description", and "markdown"',
    );
    expect(prompt).toContain("Current project description:");
    expect(prompt).toContain("Questionnaire definition:");
    expect(prompt).toContain("stitched questionnaire recap");
    expect(prompt).toContain("Assumptions and Proposed Defaults");
    expect(prompt).toContain("Do not wrap the JSON in code fences.");
    expect(prompt).toContain("Quayboard");
  });

  it("asks the questionnaire auto-answer prompt to fill blanks only", () => {
    const prompt = buildQuestionnaireAutoAnswerPrompt({
      projectName: "Quayboard",
      projectDescription: "Governed planning workspace for software teams.",
      answers: sampleAnswers,
    });

    expect(prompt).toContain('Only include keys that are currently blank.');
    expect(prompt).toContain("Do not rewrite or repeat existing answers.");
    expect(prompt).toContain("Questionnaire definition:");
    expect(prompt).toContain("Existing questionnaire answers:");
  });

  it("wraps the Product Spec brief in a JSON contract for versioned storage", () => {
    const prompt = buildProductSpecPrompt({
      projectName: "Quayboard",
      sourceMaterial: "# Overview\n\nPlanning control plane.",
    });

    expect(prompt).toContain('exactly two top-level string keys: "title" and "markdown"');
    expect(prompt).toContain("full, comprehensive, implementation-grade product specification");
    expect(prompt).toContain("Feature Catalogue");
    expect(prompt).toContain("Specification Gaps");
    expect(prompt).toContain("I will now provide the product information.");
  });

  it("asks the Product Spec review pass to tidy gaps without materially rewriting the draft", () => {
    const prompt = buildProductSpecReviewPrompt({
      projectName: "Quayboard",
      draftTitle: "Product Spec",
      draftMarkdown: "# Product Spec\n\n## Specification Gaps\n\n- TBD",
    });

    expect(prompt).toContain('exactly two top-level string keys: "title" and "markdown"');
    expect(prompt).toContain("preserve the existing scope, structure, feature set, and intent");
    expect(prompt).toContain("without changing the document materially");
    expect(prompt).toContain('convert that content into a section named "Assumptions and Proposed Defaults"');
    expect(prompt).toContain('if a final "Specification Gaps" section is empty after review, remove it');
    expect(prompt).not.toContain("Approved overview source material:");
    expect(prompt).toContain("First-pass Product Spec markdown:");
  });

  it("asks for broad, non-duplicative user-flow coverage", () => {
    const prompt = buildUserFlowPrompt({
      projectName: "Quayboard",
      sourceMaterial: "# Overview\n\nPlanning control plane.",
    });

    expect(prompt).toContain('"title", "userStory", "entryPoint", "endState", "flowSteps"');
    expect(prompt).toContain("diverse and extensive set of flows");
    expect(prompt).toContain("onboarding, happy-path, supporting, operational, and edge/failure journeys");
    expect(prompt).toContain("Approved Product Spec:");
    expect(prompt).toContain("Do not wrap the JSON in code fences.");
  });
});
