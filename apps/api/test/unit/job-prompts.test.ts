import { describe, expect, it } from "vitest";

import {
  buildRewriteMilestoneFeatureSetPrompt,
  buildRewriteMilestoneFeatureSetReviewPrompt,
  buildMilestoneFeatureSetPrompt,
  buildQuestionnaireAutoAnswerPrompt,
  buildProjectDescriptionPrompt,
  buildProjectOverviewPrompt,
  buildProductSpecPrompt,
  buildProductSpecReviewPrompt,
  buildMilestoneFeatureSetReviewPrompt,
  buildFeatureTaskListPrompt,
  buildFeatureTaskListReviewPrompt,
  buildUserFlowPrompt,
  buildDecisionConsistencyPrompt,
  buildDeliveryReviewPrompt,
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

  it("asks for prioritised, capped user-flow coverage", () => {
    const prompt = buildUserFlowPrompt({
      projectName: "Quayboard",
      sourceMaterial: "# Overview\n\nPlanning control plane.",
    });

    expect(prompt).toContain('"title", "userStory", "entryPoint", "endState", "flowSteps"');
    expect(prompt).toContain("Prefer well-specified flows over volume");
    expect(prompt).toContain("10 to 20 flows");
    expect(prompt).toContain("onboarding, happy-path, supporting, operational, and edge/failure journeys");
    expect(prompt).toContain("Approved Product Spec:");
    expect(prompt).toContain("Do not wrap the JSON in code fences.");
  });

  it("pushes milestone feature generation toward cohesive feature-sized slices", () => {
    const prompt = buildMilestoneFeatureSetPrompt({
      existingFeatures: [
        {
          dependencies: [],
          milestoneTitle: "Platform",
          summary: "Bootstrap shared setup.",
          title: "Platform setup",
        },
      ],
      milestone: {
        title: "Foundations",
        summary: "First releasable slice.",
      },
      milestoneDesignDoc: "# Design",
      milestones: [
        { title: "Platform", summary: "Shared setup." },
        { title: "Foundations", summary: "First releasable slice." },
      ],
      overviewDocument: "# Overview",
      projectName: "Quayboard",
      projectProductSpec: "# Product Spec",
      projectTechnicalSpec: "# Technical Spec",
      projectUxSpec: "# UX Spec",
      linkedUserFlows: [{ id: "11111111-1111-4111-8111-111111111111", title: "Create project" }],
    });

    expect(prompt).toContain("one coherent capability or one deliberately grouped cross-cutting workstream");
    expect(prompt).toContain("Prefer the smallest set of coherent features");
    expect(prompt).toContain("User flows linked to the selected milestone:");
    expect(prompt).toContain("keep it in one shared feature");
  });

  it("asks the feature-set review pass to merge task-sized fragmentation", () => {
    const prompt = buildMilestoneFeatureSetReviewPrompt({
      projectName: "Quayboard",
      milestone: {
        title: "Foundations",
        summary: "First releasable slice.",
      },
      milestoneDesignDoc: "# Design",
      linkedUserFlows: [{ id: "11111111-1111-4111-8111-111111111111", title: "Create project" }],
      existingFeatures: [],
      draftFeatures: [
        {
          title: "Write docs part 1",
          summary: "Docs slice.",
          acceptanceCriteria: ["Docs exist."],
          kind: "system",
          priority: "must_have",
        },
      ],
    });

    expect(prompt).toContain("Review the full set as a whole");
    expect(prompt).toContain("Merge task-sized or overlapping features");
    expect(prompt).toContain("Prefer fewer, feature-sized items");
    expect(prompt).toContain(
      "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    );
    expect(prompt).toContain(
      "priority must be one of: must_have, should_have, could_have, wont_have.",
    );
    expect(prompt).toContain("First-pass draft feature set:");
  });

  it("locks rewrite feature generation to the shared feature enums", () => {
    const prompt = buildRewriteMilestoneFeatureSetPrompt({
      issues: [{ action: "rewrite_feature_set", hint: "Close the missing milestone coverage gap." }],
      attemptNumber: 1,
      linkedUserFlows: [
        { id: "11111111-1111-4111-8111-111111111111", title: "Create project" },
      ],
      milestone: {
        title: "Foundations",
        summary: "First releasable slice.",
      },
      milestoneDesignDoc: "# Design",
      currentMilestoneFeatures: [
        {
          title: "Current feature",
          summary: "Current summary.",
        },
      ],
      existingFeatures: [],
      overviewDocument: "# Overview",
      projectName: "Quayboard",
      projectProductSpec: "# Product Spec",
      projectTechnicalSpec: "# Technical Spec",
      projectUxSpec: "# UX Spec",
    });

    expect(prompt).toContain(
      "IMPORTANT: kind MUST be exactly one of these values with no variation: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    );
    expect(prompt).toContain(
      "priority must be one of: must_have, should_have, could_have, wont_have.",
    );
    expect(prompt).toContain("acceptanceCriteria must be a non-empty array of concrete strings.");
    expect(prompt).toContain("Coverage issues to close in this rewrite:");
  });

  it("keeps rewrite feature review constrained to the shared feature enums", () => {
    const prompt = buildRewriteMilestoneFeatureSetReviewPrompt({
      issues: [{ action: "rewrite_feature_set", hint: "Close the missing milestone coverage gap." }],
      attemptNumber: 1,
      linkedUserFlows: [
        { id: "11111111-1111-4111-8111-111111111111", title: "Create project" },
      ],
      milestone: {
        title: "Foundations",
        summary: "First releasable slice.",
      },
      milestoneDesignDoc: "# Design",
      currentMilestoneFeatures: [
        {
          title: "Current feature",
          summary: "Current summary.",
        },
      ],
      existingFeatures: [],
      draftFeatures: [
        {
          title: "Replacement feature",
          summary: "Replacement summary.",
          acceptanceCriteria: ["Feature works."],
          kind: "system",
          priority: "must_have",
        },
      ],
    });

    expect(prompt).toContain(
      "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    );
    expect(prompt).toContain(
      "priority must be one of: must_have, should_have, could_have, wont_have.",
    );
    expect(prompt).toContain("acceptanceCriteria must be a non-empty array of concrete strings.");
  });

  it("adds milestone and product context to task-list generation", () => {
    const prompt = buildFeatureTaskListPrompt({
      clarifications: [{ question: "What about failures?", answer: "Show a retry path." }],
      feature: {
        acceptanceCriteria: ["User can recover from failure."],
        featureKey: "F-001",
        milestoneTitle: "Foundations",
        summary: "Failure recovery flow.",
        title: "Recovery flow",
      },
      milestoneDesignDoc: "# Milestone Design",
      planningDocuments: "# Feature Product Spec\n\n# User Documentation",
    });

    expect(prompt).toContain("smallest set of coherent implementation phases");
    expect(prompt).toContain("Approved feature planning documents:");
    expect(prompt).toContain("Milestone design document:");
    expect(prompt).toContain("full task list covers the feature acceptance criteria");
  });

  it("asks the task-list review pass to review the whole list and merge micro-tasks", () => {
    const prompt = buildFeatureTaskListReviewPrompt({
      feature: {
        acceptanceCriteria: ["User can recover from failure."],
        featureKey: "F-001",
        milestoneTitle: "Foundations",
        summary: "Failure recovery flow.",
        title: "Recovery flow",
      },
      milestoneDesignDoc: "# Milestone Design",
      planningDocuments: "# Feature Product Spec\n\n# User Documentation",
      draftTasks: [
        {
          title: "Add API field",
          description: "Add a field.",
          instructions: null,
          acceptanceCriteria: ["Field exists."],
        },
      ],
    });

    expect(prompt).toContain("Review the full task list as a whole");
    expect(prompt).toContain("Merge micro-tasks");
    expect(prompt).toContain("First-pass task list:");
  });

  it("keeps blueprint decision consistency validation focused on hard blockers only", () => {
    const prompt = buildDecisionConsistencyPrompt({
      projectName: "Quayboard",
      kind: "ux",
      productSpec: "# Product Spec",
      decisions: '[{"key":"navigation-model","selection":"Workspace shell"}]',
    });

    expect(prompt).toContain("Be conservative. Report only hard blockers");
    expect(prompt).toContain("Do not report non-critical, defaultable, or secondary gaps.");
    expect(prompt).toContain("Do not block on secondary-device nuance");
    expect(prompt).toContain("Keep the issues array to the smallest set of high-confidence blockers.");
  });

  describe("buildDeliveryReviewPrompt", () => {
    const baseInput = {
      projectName: "Quayboard",
      productSpec: "# Product Spec\n\nPlanning control plane.",
      userFlows: [
        { title: "Onboarding", userStory: "As a new user I want to set up my project." },
        { title: "Create Milestone", userStory: "As a PM I want to create a milestone." },
      ],
      milestones: [
        { title: "M1: Foundation", summary: "Core infrastructure", featureCount: 3 },
        { title: "M2: Planning", summary: "Planning features", featureCount: 0 },
      ],
    };

    it("includes the project name in the task description", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain('"Quayboard"');
    });

    it("returns a JSON contract with complete and issues keys", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain('"complete"');
      expect(prompt).toContain('"issues"');
      expect(prompt).toContain("Do not wrap the JSON in code fences.");
    });

    it("restricts jobType to GenerateUseCases or GenerateMilestones", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain('"GenerateUseCases" or "GenerateMilestones"');
    });

    it("includes milestone featureCount in the serialised milestone data", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain('"featureCount"');
      expect(prompt).toContain("3");  // featureCount for M1
    });

    it("instructs the LLM to prioritise GenerateMilestones over GenerateUseCases", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      // Milestone check comes before user flow check in instructions
      const milestoneCheckIdx = prompt.indexOf("Milestones —");
      const userFlowCheckIdx = prompt.indexOf("User Flows —");
      expect(milestoneCheckIdx).toBeGreaterThan(-1);
      expect(userFlowCheckIdx).toBeGreaterThan(-1);
      expect(milestoneCheckIdx).toBeLessThan(userFlowCheckIdx);
    });

    it("tells the LLM that milestones with featureCount > 0 are in-progress delivery", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain("featureCount > 0");
      expect(prompt).toContain("in-progress delivery");
    });

    it("instructs the LLM to be conservative about flagging user flow gaps", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain("conservative");
      expect(prompt).toContain("Prefer returning complete: true");
    });

    it("instructs the LLM not to flag user flow gaps when milestones don't yet cover existing flows", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain("Do NOT flag user flow gaps if the milestone plan does not yet cover the existing flows");
    });

    it("includes the product spec and user flows in the prompt body", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain("Approved Product Spec:");
      expect(prompt).toContain("Planning control plane.");
      expect(prompt).toContain("Approved User Flows:");
      expect(prompt).toContain("Onboarding");
    });

    it("issues are ordered milestone-first, user-flow-second", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain("milestone issues first, user flow issues second");
    });
  });
});
