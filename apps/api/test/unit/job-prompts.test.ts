import { describe, expect, it } from "vitest";

import {
  buildRewriteMilestoneFeatureSetPrompt,
  buildRewriteMilestoneFeatureSetReviewPrompt,
  buildMilestoneFeatureSetPrompt,
  buildQuestionnaireAutoAnswerPrompt,
  buildProjectOverviewPrompt,
  buildProductSpecPrompt,
  buildProductSpecReviewPrompt,
  buildMilestoneFeatureSetReviewPrompt,
  buildFeatureTaskListPrompt,
  buildFeatureTaskListReviewPrompt,
  buildUserFlowPrompt,
  buildDecisionConsistencyPrompt,
  buildDeliveryReviewPrompt,
  buildMilestonePlanPrompt,
  buildMilestoneDesignPrompt,
  buildMilestoneDesignRepairPrompt,
  buildMilestoneDesignSemanticReviewPrompt,
  buildMilestoneCoverageReviewPrompt,
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
  it("preserves the overview JSON contract while committing to a product direction", () => {
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
    expect(prompt).toContain("questionnaire recap");
    expect(prompt).toContain("commits to a product direction");
    expect(prompt).toContain("design thesis");
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

  it("allows the first milestone plan item to omit linked user flows for foundation work", () => {
    const prompt = buildMilestonePlanPrompt({
      projectName: "Quayboard",
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      userFlows: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Create project",
          userStory: "As a user I want to create a project.",
          entryPoint: "Dashboard",
          endState: "Project created",
        },
      ],
    });

    expect(prompt).toContain("The first foundations/setup milestone may use an empty useCaseIds array");
    expect(prompt).toContain("Every milestone after the first must use a non-empty useCaseIds array.");
  });

  it("keeps named first-milestone foundation minimums for small projects", () => {
    const prompt = buildMilestonePlanPrompt({
      projectName: "Quayboard",
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      userFlows: [],
      sizeProfile: {
        tier: "small",
        featureBudgetPerMilestone: 4,
        techStackHint: null,
      },
    });

    expect(prompt).toContain("AGENTS.md");
    expect(prompt).toContain("baseline docs/ADR scaffolding");
    expect(prompt).toContain("environment/bootstrap setup");
    expect(prompt).toContain("CI/test harness");
    expect(prompt).toContain("minimal smoke-path or hello-world slice");
    expect(prompt).toContain("lightweight for a small utility");
  });

  it("treats milestone rewrite guidance as hard repair criteria", () => {
    const prompt = buildMilestonePlanPrompt({
      projectName: "Quayboard",
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      userFlows: [],
      hint: "Milestone 1 is missing AGENTS.md.",
    });

    expect(prompt).toContain("Treat this guidance as hard repair criteria");
    expect(prompt).toContain("rewrite milestone 1's summary to explicitly include those items");
    expect(prompt).toContain("Milestone 1 is missing AGENTS.md.");
  });

  it("keeps milestone design generation internally consistent across sections", () => {
    const prompt = buildMilestoneDesignPrompt({
      projectName: "Quayboard",
      milestoneTitle: "Foundations",
      milestoneSummary: "First releasable slice.",
      linkedUserFlows: [
        {
          title: "Onboard user",
          userStory: "As a new user, I want a coherent first-use journey.",
          entryPoint: "Landing page",
          endState: "Dashboard",
        },
      ],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      hint: "Align the onboarding step order and screen inventory.",
    });

    expect(prompt).toContain('"title", "objective", "includedUserFlows", "scopeBoundaries"');
    expect(prompt).not.toContain('"risksAndOpenQuestions"');
    expect(prompt).toContain("Each includedUserFlows title must exactly match one linked user-flow title");
    expect(prompt).toContain("Use stable kebab-case delivery group keys");
    expect(prompt).toContain("include that screen's owning delivery group");
    expect(prompt).toContain("Keep scopeBoundaries.inScope, deliveryGroups, dependenciesAndSequencing, and exitCriteria aligned");
    expect(prompt).toContain('dependenciesAndSequencing.phase must be a non-empty string label such as "Phase 1", not a number.');
    expect(prompt).toContain('"dependenciesAndSequencing"');
    expect(prompt).toContain('"phase": "Phase 1"');
    expect(prompt).toContain("Do not list a trigger, mechanic, ordering rule, or dependency as required");
    expect(prompt).toContain("Mention GAME_OVER transitions only when the triggering mechanism is explicitly in scope");
    expect(prompt).toContain("Repair guidance:");
  });

  it("passes prior semantic failures into milestone design generation as blockers", () => {
    const prompt = buildMilestoneDesignPrompt({
      projectName: "Quayboard",
      milestoneTitle: "Session Persistence",
      milestoneSummary: "Restore saved preferences.",
      linkedUserFlows: [
        {
          title: "Return user",
          userStory: "As a returning user, I want my session restored.",
          entryPoint: "App URL",
          endState: "Saved preferences are active.",
        },
      ],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      semanticFeedback: [
        {
          issues: ["Fullscreen cannot be requested on page load."],
          repairHint: "Use a Resume Experience prompt as the required user gesture.",
        },
      ],
    });

    expect(prompt).toContain("Blocking semantic repair checklist:");
    expect(prompt).toContain("hard non-regression criteria");
    expect(prompt).toContain("this checklist wins for this draft");
    expect(prompt).toContain("Fullscreen cannot be requested on page load.");
    expect(prompt).toContain("Use a Resume Experience prompt");
  });

  it("uses repair guidance to reconcile structured milestone design contradictions", () => {
    const prompt = buildMilestoneDesignRepairPrompt({
      projectName: "Quayboard",
      milestoneTitle: "Foundations",
      milestoneSummary: "First releasable slice.",
      linkedUserFlows: [
        {
          title: "Onboard user",
          userStory: "As a new user, I want a coherent first-use journey.",
          entryPoint: "Landing page",
          endState: "Dashboard",
        },
      ],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      issues: ["Flow ownership and screen inventory disagree."],
      draftJson: '{"title":"Milestone Design"}',
      hint: "Align screen inventory and Delivery Shape ownership.",
    });

    expect(prompt).toContain("Repair the structured milestone design draft");
    expect(prompt).toContain("Validator issues:");
    expect(prompt).toContain("Previous structured milestone design draft:");
    expect(prompt).toContain('dependenciesAndSequencing.phase must be a non-empty string label such as "Phase 1", not a number.');
    expect(prompt).toContain('"deliveryGroupKeys": [');
    expect(prompt).toContain("include that screen's owning delivery group");
    expect(prompt).toContain("Do not leave an exit criterion, transition, ordering rule, or acceptance expectation");
    expect(prompt).toContain("If GAME_OVER or another terminal state is mentioned, include only the in-scope trigger");
    expect(prompt).toContain("Repair guidance:");
  });

  it("passes prior semantic failures into milestone design repair as blockers", () => {
    const prompt = buildMilestoneDesignRepairPrompt({
      projectName: "Quayboard",
      milestoneTitle: "Session Persistence",
      milestoneSummary: "Restore saved preferences.",
      linkedUserFlows: [],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      issues: ["Flow ownership and screen inventory disagree."],
      draftJson: '{"title":"Milestone Design"}',
      semanticFeedback: [
        {
          issues: ["AudioContext resumption needs a user gesture."],
          repairHint: "Keep session storage read-only until the resume click.",
        },
      ],
    });

    expect(prompt).toContain("Blocking semantic repair checklist:");
    expect(prompt).toContain("AudioContext resumption needs a user gesture.");
    expect(prompt).toContain("Keep session storage read-only until the resume click.");
  });

  it("asks semantic milestone design review to catch shared-resource contradictions", () => {
    const prompt = buildMilestoneDesignSemanticReviewPrompt({
      projectName: "Audio Board",
      milestoneTitle: "Procedural Audio",
      milestoneSummary: "Add audio transitions and dampening.",
      linkedUserFlows: [],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      draftJson: '{"deliveryGroups":[]}',
    });

    expect(prompt).toContain('"ok"');
    expect(prompt).toContain("shared resources with conflicting controllers");
    expect(prompt).toContain("Web Audio GainNode");
    expect(prompt).toContain("voice stealing prioritizes most recent and loudest frequencies");
    expect(prompt).toContain("repairHint");
  });

  it("asks semantic review to enforce prior semantic repair decisions", () => {
    const prompt = buildMilestoneDesignSemanticReviewPrompt({
      projectName: "Audio Board",
      milestoneTitle: "Session Persistence",
      milestoneSummary: "Restore saved preferences.",
      linkedUserFlows: [],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
      draftJson: '{"deliveryGroups":[]}',
      semanticFeedback: [
        {
          issues: ["The return-user flow cannot silently enter fullscreen."],
          repairHint: "Require a visible resume prompt before fullscreen restoration.",
        },
      ],
    });

    expect(prompt).toContain("blocking semantic repair checklist");
    expect(prompt).toContain("instead of re-litigating the superseded contradiction");
    expect(prompt).toContain("The return-user flow cannot silently enter fullscreen.");
    expect(prompt).toContain("Require a visible resume prompt");
  });

  it("tells foundation milestone design generation not to invent user flows", () => {
    const prompt = buildMilestoneDesignPrompt({
      projectName: "Quayboard",
      milestoneTitle: "Project Foundation",
      milestoneSummary: "Bootstrap the repository and delivery scaffolding.",
      linkedUserFlows: [],
      uxSpec: "# UX Spec",
      technicalSpec: "# Technical Spec",
    });

    expect(prompt).toContain("includedUserFlows must be an empty array");
    expect(prompt).toContain("Do not invent user flows for this milestone");
    expect(prompt).toContain("Foundation milestone example:");
    expect(prompt).toContain('"includedUserFlows": []');
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
    expect(prompt).toContain("Included User Flows and Delivery Shape groupings as hard boundary constraints");
    expect(prompt).toContain("Cover every delivery group named in the milestone design document");
    expect(prompt).toContain("Every exit criterion in the milestone design document must map to at least one feature acceptance criterion.");
    expect(prompt).toContain("Rendering groups must cover the full named rendering scope");
    expect(prompt).toContain("Do not include acceptance criteria that depend on mechanics, collision checks, ordering rules, or behaviors");
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
    expect(prompt).toContain("named flow steps, screens, and Delivery Shape groups");
    expect(prompt).toContain("Ensure every delivery group named in the milestone design document is covered");
    expect(prompt).toContain("Ensure the reviewed set collectively satisfies every exit criterion");
    expect(prompt).toContain("Treat partial coverage as incomplete.");
    expect(prompt).toContain("Remove or rewrite any acceptance criterion that depends on out-of-scope mechanics");
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
    expect(prompt).toContain("Resolve the named issues into one consistent ownership model");
    expect(prompt).toContain("Cover every delivery group named in the milestone design document");
    expect(prompt).toContain("Every exit criterion in the milestone design document must map to at least one rewritten feature acceptance criterion.");
    expect(prompt).toContain("Treat partial coverage as incomplete.");
    expect(prompt).toContain("Do not include rewritten acceptance criteria that depend on mechanics, collision checks, ordering rules");
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
    expect(prompt).toContain("Ensure the final rewrite covers every delivery group named in the milestone design document");
    expect(prompt).toContain("Ensure the final rewrite collectively satisfies every milestone exit criterion");
    expect(prompt).toContain("Treat partial coverage as incomplete.");
    expect(prompt).toContain("Remove or rewrite any acceptance criterion that depends on out-of-scope mechanics");
  });

  it("keeps milestone coverage review focused on rewriteable gaps before escalating to human review", () => {
    const prompt = buildMilestoneCoverageReviewPrompt({
      milestone: {
        title: "Foundations",
        summary: "First releasable slice.",
      },
      milestoneDesignDoc: "# Milestone Design",
      features: [
        {
          acceptanceCriteria: ["Feature works."],
          featureKey: "F-001",
          workstreams: {
            product: "approved",
            ux: "approved",
            tech: "approved",
            userDocs: "missing",
            archDocs: "approved",
          },
          title: "Routing core",
          summary: "Implements the routing backbone.",
          taskCount: 1,
          taskTitles: ["Implement route"],
        },
      ],
    });

    expect(prompt).toContain('Use "rewrite_feature_set" when the current milestone feature boundaries need to be rewritten to resolve the gap cleanly.');
    expect(prompt).toContain('If the milestone design doc itself is coherent and the gap can be fixed by rewriting or expanding features, prefer "rewrite_feature_set".');
    expect(prompt).toContain('Use "needs_human_review" only when the milestone design doc still contains an unresolved contradiction or missing decision');
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
      coverage: {
        approvedUserFlowCount: 2,
        coveredUserFlowCount: 2,
        uncoveredUserFlowTitles: [],
      },
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

    it("treats the structured coverage summary as authoritative", () => {
      const prompt = buildDeliveryReviewPrompt(baseInput);
      expect(prompt).toContain("authoritative structured data");
      expect(prompt).toContain("Authoritative milestone coverage summary");
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

    it("uses the same named foundation minimums as milestone generation", () => {
      const prompt = buildDeliveryReviewPrompt({
        ...baseInput,
        sizeProfile: {
          tier: "medium",
          featureBudgetPerMilestone: 6,
          techStackHint: null,
        },
      });

      expect(prompt).toContain("AGENTS.md");
      expect(prompt).toContain("baseline docs/ADR scaffolding");
      expect(prompt).toContain("environment/bootstrap setup");
      expect(prompt).toContain("CI/test harness");
      expect(prompt).toContain("minimal smoke-path or hello-world slice");
      expect(prompt).toContain("Fail milestone review if milestone 1 does not explicitly establish those named foundation minimums.");
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
