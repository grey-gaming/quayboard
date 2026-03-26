import { describe, expect, it } from "vitest";

import {
  buildQuestionnaireAutoAnswerPrompt,
  buildProjectDescriptionPrompt,
  buildProjectOverviewPrompt,
  buildMilestoneDesignConsistencyPrompt,
  buildMilestoneDesignPrompt,
  buildMilestoneDesignReviewPrompt,
  buildMilestonePlanPrompt,
  buildMilestonePlanReviewPrompt,
  buildProductSpecPrompt,
  buildProductSpecReviewPrompt,
  buildUserFlowPrompt,
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

  it("asks milestone generation for thematic titles without numeric prefixes", () => {
    const prompt = buildMilestonePlanPrompt({
      projectName: "Quayboard",
      uxSpec: "# UX Spec\n\nApproved UX direction.",
      technicalSpec: "# Technical Spec\n\nApproved implementation direction.",
      userFlows: [
        {
          id: "flow-1",
          title: "Plan milestones",
          userStory: "As a planner, I want coherent milestone sequencing.",
          entryPoint: "Mission Control",
          endState: "Approved milestones exist.",
        },
      ],
    });

    expect(prompt).toContain("title must be short, specific, and thematic.");
    expect(prompt).toContain('Do not include milestone numbers, ordinal labels, or prefixes such as "Milestone 1", "Phase 2", or "M3" in title.');
  });

  it("asks milestone review to preserve order while removing numeric title labels", () => {
    const prompt = buildMilestonePlanReviewPrompt({
      projectName: "Quayboard",
      draftMilestones: [
        {
          title: "Milestone 1: Foundations",
          summary: "Stand up the planning core.",
          useCaseIds: ["flow-1"],
        },
      ],
    });

    expect(prompt).toContain("Preserve the milestone count, execution order, and overall flow coverage");
    expect(prompt).toContain('Remove milestone numbers, ordinal labels, and prefixes such as "Milestone 1", "Phase 2", or "M3" from title.');
  });

  it("grounds milestone design generation in canonical order and bans vague future deferrals", () => {
    const prompt = buildMilestoneDesignPrompt({
      projectName: "Quayboard",
      milestonePosition: 2,
      milestoneTitle: "Workflow Automation",
      milestoneSummary: "Automate project planning progression.",
      orderedMilestones: [
        { position: 1, title: "Foundations", summary: "Core setup" },
        { position: 2, title: "Workflow Automation", summary: "Auto-advance planning" },
      ],
      linkedUserFlows: [
        {
          title: "Run auto-advance",
          userStory: "As a planner, I want automated planning progression.",
          entryPoint: "Mission Control",
          endState: "The project advances automatically.",
        },
      ],
      uxSpec: "# UX Spec\n\nApproved UX direction.",
      technicalSpec: "# Technical Spec\n\nApproved implementation direction.",
    });

    expect(prompt).toContain("Treat the milestone order supplied below as canonical.");
    expect(prompt).toContain('Do not defer required work to an unnamed future phase such as "a later milestone", "future milestone", or similar vague wording.');
    expect(prompt).toContain("Ordered milestone list:");
  });

  it("asks milestone design review to remove vague future deferrals", () => {
    const prompt = buildMilestoneDesignReviewPrompt({
      projectName: "Quayboard",
      milestone: {
        position: 2,
        title: "Workflow Automation",
        summary: "Automate project planning progression.",
      },
      orderedMilestones: [
        { position: 1, title: "Foundations", summary: "Core setup" },
        { position: 2, title: "Workflow Automation", summary: "Auto-advance planning" },
      ],
      draftTitle: "Workflow Automation Design",
      draftMarkdown: "# Workflow Automation\n\nShip the rest in a later milestone.",
    });

    expect(prompt).toContain('Remove vague deferrals such as "later milestone", "future milestone", or equivalent wording.');
    expect(prompt).toContain("If sequencing must be mentioned, refer only to concrete milestones");
  });

  it("asks milestone consistency review to reconcile the current draft against existing milestone docs", () => {
    const prompt = buildMilestoneDesignConsistencyPrompt({
      projectName: "Quayboard",
      milestone: {
        position: 2,
        title: "Workflow Automation",
        summary: "Automate project planning progression.",
      },
      orderedMilestones: [
        { position: 1, title: "Foundations", summary: "Core setup" },
        { position: 2, title: "Workflow Automation", summary: "Auto-advance planning" },
      ],
      currentDraft: {
        title: "Workflow Automation Design",
        markdown: "# Workflow Automation\n\nDraft milestone scope.",
      },
      existingCanonicalDesignDocs: [
        {
          position: 1,
          milestoneTitle: "Foundations",
          designDocTitle: "Foundations Design",
          markdown: "# Foundations\n\nCore setup.",
        },
      ],
    });

    expect(prompt).toContain("Only revise the current milestone design document.");
    expect(prompt).toContain("Existing canonical milestone design docs from the project:");
    expect(prompt).toContain("Ensure the current draft does not silently defer required work to unspecified later milestones.");
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
