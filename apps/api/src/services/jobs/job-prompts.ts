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

const productSpecPrompt = `You are a senior product strategist, systems designer, game designer, UX designer, and technical product spec writer.

Your task is to transform the product information I provide into a full, comprehensive, implementation-grade product specification.

The output must be suitable for product, design, engineering, QA, content, and planning teams. It must aim for completeness over brevity.

## Objective
Produce a complete product specification that identifies and defines:
- all core features
- all supporting features
- all systems
- all components
- all modules
- all mechanics
- all user-facing elements
- all content/object types
- all entities/items/resources where relevant
- all workflows
- all states, rules, and edge cases
- all constraints and non-goals
- all assumptions, dependencies, and unresolved questions

If the product is a game, include gameplay systems, loops, progression, economy, entities, items, resources, maps/world structure, UI surfaces, balancing concerns, and content inventories.

If the product is not a game, adapt the same level of depth to the relevant product structure, including workflows, objects, permissions, states, data entities, UI surfaces, integrations, and operational rules.

## Source Material Rule
Use the material I provide as the primary source of truth.

You must:
1. Extract everything explicitly stated.
2. Expand it into a complete spec.
3. Infer missing but necessary elements where needed.

Do not leave major areas underspecified. When information is missing, do not stop. Make the strongest reasonable product assumptions.

## Output Requirements
Write the specification using clear headings and structured subsections.

The specification must include, where relevant:

### 1. Product Definition
- product name
- product type
- one-paragraph overview
- product vision
- design principles
- intended experience / product feel
- target audience and user segments
- roles / personas / archetypes

### 2. Problem, Opportunity, and Value
- problem being solved
- market/user opportunity
- value proposition
- differentiation

### 3. Core User Experience
- primary use cases
- user goals
- primary workflows
- session types
- player/customer journey
- onboarding path
- first-time user experience
- return user experience

### 4. Core Loops and Structure
For games:
- core gameplay loop
- secondary loops
- long-term progression loop
- retention loop
- fail/recover loop
- resource loop
- expansion loop

For non-game products:
- primary usage loop
- repeat engagement loop
- value realization loop
- setup/admin loop
- collaboration/operations loop if relevant

### 5. Complete Feature Inventory
Provide a hierarchical feature breakdown:
- epic / feature area
- feature
- sub-feature
- user-facing capability
- supporting systems
- dependencies

This section must aim to be exhaustive.

### 6. Complete System and Component Breakdown
Identify all major systems and sub-systems. For each, include:
- purpose
- inputs
- outputs
- rules
- important states
- dependencies
- UX implications
- balancing/operational implications if relevant

### 7. Object / Entity / Item / Content Inventory
List all important product objects.

For games, include as applicable:
- resources
- items
- buildings
- units
- contracts
- markets
- upgrades
- technologies
- locations
- regions
- routes
- factions
- missions
- events
- governance rules
- currencies
- unlockables
- achievements
- data artifacts / reports / dashboards

For non-games, include as applicable:
- users
- workspaces
- projects
- documents
- records
- tasks
- permissions
- templates
- integrations
- reports
- notifications
- automations
- system objects and statuses

For each object/entity type, define:
- what it is
- why it exists
- attributes/properties
- state changes
- lifecycle
- related objects

### 8. UX and Interface Specification
List all major UI surfaces/screens/views, such as:
- home/dashboard
- onboarding/tutorial
- core workspace
- detail views
- editor/build mode
- map/network view
- analytics/reports
- settings
- alerts/issues
- progression/unlock views
- help/reference surfaces

For each surface include:
- purpose
- main actions
- information shown
- key components
- states
- mobile/desktop considerations if relevant

### 9. Rules, Logic, and State Changes
Define:
- rules engine / business logic / simulation logic
- progression logic
- unlock logic
- pricing/economy logic
- cooldowns/timers if applicable
- win/fail conditions if applicable
- edge cases
- conflict resolution rules
- offline/async behavior if relevant
- save/load and persistence behavior

### 10. Progression, Balance, and Pacing
If relevant, define:
- progression model
- pacing expectations
- challenge curve
- difficulty/balance principles
- anti-grind rules
- reward cadence
- session-length expectations
- late-game / endgame expectations

### 11. Economy / Simulation / Operational Model
If relevant, define:
- production and consumption
- supply and demand
- price movement
- capacity constraints
- throughput limits
- bottleneck behavior
- optimization levers
- governance/policy effects
- background/offline progression model

### 12. Content and Scope Breakdown
Provide a content framework showing:
- must-have content
- launch content
- repeatable content
- procedural/generated content if any
- extensibility points
- content categories
- minimum viable content quantities where useful

### 13. Technical and Data Considerations
Define high-level technical implications:
- platform assumptions
- persistence model
- offline behavior
- performance constraints
- client/server split if any
- simulation model
- data entities
- telemetry/events
- configuration needs
- modifiability/extensibility if relevant

### 14. Non-Functional Requirements
Include:
- usability
- clarity
- accessibility
- performance
- reliability
- battery/network efficiency where relevant
- maintainability
- scalability where relevant
- privacy/security where relevant

### 15. Constraints, Non-Goals, and Boundaries
Clearly list:
- explicit constraints
- out-of-scope areas
- non-goals
- visual/style constraints
- platform constraints
- business constraints if stated

### 16. Risks and Design Tensions
Call out major tensions such as:
- depth vs simplicity
- short sessions vs strategic richness
- offline simulation vs accuracy
- clarity vs data density
- progression vs grind
- flexibility vs overwhelm

### 17. Final Deliverables Section
End with these three structured outputs:
1. Feature Catalogue — exhaustive list of features and sub-features
2. Component Catalogue — exhaustive list of product systems, modules, UI surfaces, and content objects
3. Specification Gaps — anything still unknown, ambiguous, or assumption-driven

## Writing Standards
- Be specific, not generic.
- Prefer concrete mechanics, structures, and component definitions.
- Avoid filler language.
- Do not merely summarize the source material.
- Expand it into a full product specification.
- Where appropriate, use tables or structured lists, but keep the document readable.
- Explicitly distinguish fact from inference.

## Completeness Check
Before finalizing, silently review your own output and ensure:
- no major product area is missing
- all features implied by the source have been unpacked
- all systems have components and states
- all workflows have entry points and outcomes
- all important objects/entities have been inventoried
- assumptions are clearly labeled`;

export const buildProductSpecPrompt = (input: {
  projectName: string;
  sourceMaterial: string;
}) =>
  [
    `Create a complete Product Spec for "${input.projectName}".`,
    'Return valid JSON with exactly two top-level string keys: "title" and "markdown".',
    'The "markdown" value must contain the full product specification.',
    "Do not wrap the JSON in code fences.",
    "",
    productSpecPrompt,
    "",
    "I will now provide the product information.",
    "",
    input.sourceMaterial,
  ].join("\n");

export const buildProductSpecReviewPrompt = (input: {
  draftMarkdown: string;
  draftTitle: string;
  projectName: string;
}) =>
  [
    `Review and tidy the completed Product Spec for "${input.projectName}".`,
    'Return valid JSON with exactly two top-level string keys: "title" and "markdown".',
    'The "title" should stay the same unless a minor wording cleanup is genuinely needed.',
    'The "markdown" must remain the same Product Spec, improved through review rather than materially rewritten.',
    "Do not wrap the JSON in code fences.",
    "",
    "Review goals:",
    "- inspect the draft for specification gaps, inconsistencies, duplication, and weak assumptions",
    "- resolve missing details when they can be inferred reasonably from the existing draft",
    "- preserve the existing scope, structure, feature set, and intent",
    "- improve clarity, completeness, consistency, and organization without changing the document materially",
    '- if a final "Specification Gaps" section is empty after review, remove it',
    '- if unresolved items remain, convert that content into a section named "Assumptions and Proposed Defaults" instead of "Specification Gaps"',
    "- explicitly label any remaining inference or assumption-driven content",
    "",
    "First-pass Product Spec title:",
    input.draftTitle,
    "",
    "First-pass Product Spec markdown:",
    input.draftMarkdown,
  ].join("\n");

export const buildUserFlowPrompt = (input: {
  projectName: string;
  sourceMaterial: string;
  hint?: string;
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
    "Report contradictions, missing selections, or major coverage gaps in the issues array.",
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

export const buildMilestonePlanPrompt = (input: {
  projectName: string;
  uxSpec: string;
  technicalSpec: string;
  userFlows: Array<{
    id: string;
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  hint?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Propose an initial milestone plan for "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each array item must be an object with exactly these keys: title, summary, useCaseIds.",
    "title must be short and specific.",
    "summary must explain the release intent and scope for the milestone.",
    "useCaseIds must be a non-empty array of approved user-flow IDs covered by the milestone.",
    "Do not repeat the same user flow in multiple milestones unless the overlap is necessary.",
    "Create milestones in execution order, from foundational work to higher-level capability.",
    "Do not wrap the JSON in code fences.",
    ...(input.hint
      ? [
          "",
          "## Guidance",
          input.hint,
        ]
      : []),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
    "",
    "Approved user flows:",
    JSON.stringify(input.userFlows, null, 2),
  ].join("\n");

export const buildMilestoneDesignPrompt = (input: {
  projectName: string;
  milestoneTitle: string;
  milestoneSummary: string;
  linkedUserFlows: Array<{
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  uxSpec: string;
  technicalSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Create a milestone design document for "${input.milestoneTitle}" in "${input.projectName}".`,
    'Return valid JSON with exactly two string keys: "title" and "markdown".',
    "The markdown must be a polished planning artifact suitable for implementation sequencing and milestone review.",
    "Use these section headings in this exact order: Milestone Objective, Included User Flows, Scope Boundaries, Delivery Shape, Dependencies and Sequencing, Risks and Open Questions, Exit Criteria.",
    "Do not wrap the JSON in code fences.",
    "",
    "Milestone summary:",
    input.milestoneSummary,
    "",
    "Linked user flows:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
  ].join("\n");

export const buildAppendFeaturesFromOnePagerPrompt = (input: {
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  milestones: Array<{
    summary: string;
    title: string;
  }>;
  overviewDocument: string;
  projectName: string;
  projectProductSpec: string;
  projectTechnicalSpec: string;
  projectUxSpec: string;
  userFlows: Array<{
    flowSteps: string[];
    title: string;
    acceptanceCriteria: string[];
    userStory: string;
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Append implementation-ready feature candidates for milestone "${input.milestone.title}" in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Create features only for the selected milestone.",
    "Use the approved planning documents and milestone design document to understand the current context.",
    "Build on work already planned in earlier or parallel milestones instead of recreating it.",
    "Do not repeat or lightly rename an existing feature from any milestone.",
    "Order the proposed features so they can be implemented in a sensible sequence within the milestone.",
    "Prefer concrete vertical slices over vague epics.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved overview document:",
    input.overviewDocument,
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
    "",
    "Approved user flows:",
    JSON.stringify(input.userFlows, null, 2),
    "",
    "Ordered milestone list:",
    JSON.stringify(input.milestones, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
  ].join("\n");

const renderFeatureContext = (input: {
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

export const buildFeatureProductSpecPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  productSpec: string;
  technicalSpec: string;
  uxSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    "Generate a feature-scoped Product Spec from the approved project Product Spec, UX Spec, and Technical Spec.",
    "Return valid JSON with top-level keys: \"title\", \"markdown\", and \"requirements\".",
    "The markdown must be detailed, implementation-oriented, and scoped only to the feature described below.",
    "The requirements object must contain boolean keys: uxRequired, techRequired, userDocsRequired, archDocsRequired.",
    "Do not wrap the JSON in code fences.",
    "",
    "Feature context:",
    renderFeatureContext(input.feature),
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

export const buildFeatureUxSpecPrompt = (input: {
  featureProductSpec: string;
  featureTitle: string;
  projectProductSpec: string;
  projectUxSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the feature-scoped UX Spec for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Use the approved feature Product Spec as the main scope definition and the approved project UX Spec as the UX-system reference.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved feature Product Spec:",
    input.featureProductSpec,
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
  projectProductSpec: string;
  projectTechnicalSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the feature-scoped Technical Spec for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Use the approved feature Product Spec as the main scope definition and the approved project Technical Spec as the technical-system reference.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved feature Product Spec:",
    input.featureProductSpec,
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
  projectProductSpec: string;
  projectUxSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate user-facing documentation for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Focus on user-facing behavior, setup expectations, and walkthrough guidance rather than implementation details.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
  ].join("\n");

export const buildFeatureArchDocsPrompt = (input: {
  featureTechSpec: string;
  featureTitle: string;
  projectTechnicalSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate internal architecture documentation for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Focus on architecture rationale, responsibilities, data flow, interfaces, and constraints.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved feature Technical Spec:",
    input.featureTechSpec,
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
  ].join("\n");

export const buildTaskClarificationsPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  techSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate clarification questions for implementing "${input.feature.title}".`,
    "Return valid JSON as a non-empty array of objects.",
    "Each object must have a \"question\" key with a clear, specific question for the implementation.",
    "Each object may have an optional \"context\" key with additional context.",
    "Focus on ambiguous areas in the tech spec, acceptance criteria, or implementation approach.",
    "Ask about edge cases, error handling, integration points, and data model decisions.",
    "Do not wrap the JSON in code fences.",
    "",
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature Technical Spec:",
    input.techSpec,
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
  techSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Answer clarification questions for implementing "${input.feature.title}".`,
    "Return valid JSON as an array of objects matching the input order.",
    "Each object must have an \"answer\" key with a helpful, implementation-focused answer.",
    "Derive answers from the tech spec, feature context, and standard software engineering practices.",
    "Do not wrap the JSON in code fences.",
    "",
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature Technical Spec:",
    input.techSpec,
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
  techSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate an ordered implementation task list for "${input.feature.title}".`,
    "Return valid JSON as a non-empty array of objects.",
    "Each object must have: \"title\", \"description\", \"instructions\" (optional), \"acceptanceCriteria\" (array).",
    "Order tasks in implementation sequence: setup, core logic, integration, testing.",
    "Each task should be completable in a single implementation session.",
    "Instructions should provide concrete guidance for how to implement.",
    "Do not wrap the JSON in code fences.",
    "",
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Approved feature Technical Spec:",
    input.techSpec,
    "",
    "Clarification answers:",
    JSON.stringify(input.clarifications, null, 2),
  ].join("\n");

export const buildDeliveryReviewPrompt = (input: {
  projectName: string;
  productSpec: string;
  userFlows: Array<{ title: string; userStory: string }>;
  milestones: Array<{ title: string; summary: string }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review the planning deliverables for "${input.projectName}" and assess whether they sufficiently satisfy the Product Spec.`,
    'Return valid JSON with exactly two keys: "complete" (boolean) and "issues" (array).',
    'Set "complete" to true only when all checks below pass with no meaningful gaps.',
    "If any gaps are found, set complete to false and list each issue in the issues array.",
    'Each issue must be an object with exactly two string keys: "jobType" and "hint".',
    '"jobType" must be exactly one of: "GenerateUseCases" or "GenerateMilestones".',
    '"hint" must clearly describe what is missing and why, so the generation job can produce only the missing content.',
    "Issues must be ordered by workflow dependency: user flow issues first, milestone issues second.",
    "Do not wrap the JSON in code fences.",
    "",
    "Checks to perform:",
    "1. User Flows — do the user flows collectively cover all distinct journeys implied by the Product Spec?",
    "   Look for missing onboarding, admin, error/recovery, and key happy-path flows.",
    "2. Milestones — do the milestones provide a coherent, complete delivery plan that covers all approved user flows and the full product scope?",
    "   Look for missing phases, uncovered user flows, or milestones that skip important foundational work.",
    "3. Overall — given the product spec, user flows, and milestones together, is the planning complete enough to begin implementation?",
    "",
    "Approved Product Spec:",
    input.productSpec,
    "",
    "Approved User Flows:",
    JSON.stringify(input.userFlows, null, 2),
    "",
    "Approved Milestones:",
    JSON.stringify(input.milestones, null, 2),
  ].join("\n");

