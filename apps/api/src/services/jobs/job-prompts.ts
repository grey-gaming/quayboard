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
    "Make the writing concrete, creative, and product-quality. Avoid generic software-product filler.",
    "Stated requirements take priority over inferred additions. Place any inferred capabilities or proposed defaults exclusively in the Assumptions and Proposed Defaults section — do not embed them throughout the document as if they were confirmed scope.",
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

## Proportionality Rule
Scale the depth and feature inventory to match the stated project size and scope. A "small web app" or simple utility does not need full enterprise subsystems, multi-device sync architecture, or a comprehensive platform feature stack.

When you infer a capability that is not explicitly stated in the source material, mark it clearly as an assumption or proposed default — not as a settled requirement. Place all such inferences in the Assumptions section rather than embedding them throughout the spec as if they were confirmed scope.

Do not add platform capabilities (offline support, push notifications, service workers, real-time sync, PWA installability, invitation systems, public sharing links) unless the source material explicitly requires them. If you believe one of these is a natural fit, note it as a proposed extension in the Assumptions section only.

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
  hint?: string;
}) =>
  [
    `Create a complete Product Spec for "${input.projectName}".`,
    'Return valid JSON with exactly two top-level string keys: "title" and "markdown".',
    'The "markdown" value must contain the full product specification.',
    "Do not wrap the JSON in code fences.",
    "",
    productSpecPrompt,
    ...(input.hint
      ? [
          "",
          "## Important guidance for this attempt",
          input.hint,
        ]
      : []),
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

export const buildProductSpecQualityCheckPrompt = (input: {
  projectName: string;
  draftTitle: string;
  draftMarkdown: string;
}) =>
  [
    `You are reviewing a generated Product Spec for the project "${input.projectName}".`,
    "Your job is to detect significant quality failures only — not minor wording issues.",
    "",
    'Return valid JSON with exactly two top-level keys: "hasSignificantIssues" (boolean) and "hint" (string).',
    'Set "hasSignificantIssues" to true only when the document has a critical problem, such as:',
    `- The content is not a product spec at all (e.g. a job posting, article, legal document, or other unrelated content)`,
    `- The content is for a completely different product or domain, with no meaningful alignment to "${input.projectName}"`,
    "- The content is almost entirely placeholder or template text with no real specification",
    'When "hasSignificantIssues" is true, set "hint" to a concise description of the specific problem found, suitable for guiding a regeneration attempt.',
    'When "hasSignificantIssues" is false, set "hint" to an empty string.',
    "Do not flag minor gaps, stylistic issues, or incomplete sections — those are handled in a separate review pass.",
    "Do not wrap the JSON in code fences.",
    "",
    "Product Spec title:",
    input.draftTitle,
    "",
    "Product Spec markdown:",
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
    `Generate a prioritised set of user flows for "${input.projectName}".`,
    'Return valid JSON as an array of objects with these keys: "title", "userStory", "entryPoint", "endState", "flowSteps", "coverageTags", "acceptanceCriteria", and "doneCriteriaRefs".',
    'Each "flowSteps" value must be an array of plain strings only. Do not return step objects, numbered objects, or nested structures.',
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
    "useCaseIds must be an array of approved user-flow IDs covered by the milestone.",
    "The first foundations/setup milestone may use an empty useCaseIds array when it only contains cross-cutting project setup work.",
    "Every milestone after the first must use a non-empty useCaseIds array.",
    "Do not repeat the same user flow in multiple milestones unless the overlap is necessary.",
    "Create milestones in execution order, from foundational work to higher-level capability.",
    'This product flow is always greenfield. The first milestone must be a foundations/setup milestone.',
    "The first milestone must cover repository and delivery scaffolding such as AGENTS.md, initial folder structure, baseline docs/ADR scaffolding, environment/bootstrap setup, CI/test harness, and a minimal smoke-path or hello-world slice.",
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

export const buildAppendMilestonePlanPrompt = (input: {
  projectName: string;
  uxSpec: string;
  technicalSpec: string;
  existingMilestones: Array<{
    title: string;
    summary: string;
    featureCount: number;
  }>;
  uncoveredUserFlows: Array<{
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
    `Append follow-up milestones for the uncovered user flows in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each array item must be an object with exactly these keys: title, summary, useCaseIds.",
    "title must be short and specific.",
    "summary must explain the release intent and scope for the appended milestone.",
    "useCaseIds must be a non-empty array of uncovered approved user-flow IDs covered by the appended milestone.",
    "Generate only new follow-up milestones. Do not rewrite, rename, or reorder the existing milestones.",
    "Every uncovered user flow must appear exactly once across the appended milestones.",
    "Keep the appended milestones coherent and appendable after the existing implemented milestones.",
    "Do not wrap the JSON in code fences.",
    ...(input.hint
      ? [
          "",
          "## Guidance",
          input.hint,
        ]
      : []),
    "",
    "Existing milestones (read-only context):",
    JSON.stringify(input.existingMilestones, null, 2),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
    "",
    "Uncovered approved user flows to place in new milestones:",
    JSON.stringify(input.uncoveredUserFlows, null, 2),
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
  hint?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Create a structured milestone design draft for "${input.milestoneTitle}" in "${input.projectName}".`,
    'Return valid JSON with exactly these top-level keys: "title", "objective", "includedUserFlows", "scopeBoundaries", "deliveryGroups", "dependenciesAndSequencing", and "exitCriteria".',
    "includedUserFlows must be a non-empty array. Each item must contain: title, summary, steps, deliveryGroupKeys, and screens.",
    'Each includedUserFlows title must exactly match one linked user-flow title from the provided list.',
    'scopeBoundaries must be an object with exactly two array keys: "inScope" and "outOfScope". Every in-scope item must contain: item and deliveryGroupKey.',
    "deliveryGroups must be a non-empty array. Each item must contain: key, title, summary, ownedScreens, ownedResponsibilities, dependsOn, mustStayTogether, and mustNotSplit.",
    "Use stable kebab-case delivery group keys. Every named screen and owned responsibility must belong to exactly one delivery group.",
    "For every screen named in includedUserFlows.screens or exitCriteria.screens, include that screen's owning delivery group in the same flow or exit criterion context.",
    "Keep scopeBoundaries.inScope, deliveryGroups, dependenciesAndSequencing, and exitCriteria aligned to one resolved interpretation of the milestone. If a risk or ambiguity is resolved in one section, apply that same choice everywhere else.",
    "Do not list a trigger, mechanic, ordering rule, or dependency as required in objective, includedUserFlows, deliveryGroups, or exitCriteria if it is listed in outOfScope.",
    "Mention GAME_OVER transitions only when the triggering mechanism is explicitly in scope for this milestone. Otherwise keep the milestone focused on the in-scope loop and omit that transition.",
    "dependenciesAndSequencing must be a non-empty array. Each item must contain: phase, deliveryGroupKeys, and notes.",
    "exitCriteria must be a non-empty array. Each item must contain: criterion, deliveryGroupKey, and screens.",
    "The structure must describe one internally consistent milestone. Do not let flow steps, screen ownership, sequencing, or required-vs-optional rules contradict each other.",
    "Do not wrap the JSON in code fences.",
    "Use this shape for tricky fields: steps must be an array of strings, outOfScope must be an array of strings, ownedScreens may be [], mustStayTogether and mustNotSplit must be booleans or string arrays, and backend-only exit criteria may use screens: [].",
    "",
    "Example JSON fragment:",
    JSON.stringify(
      {
        includedUserFlows: [
          {
            title: "Linked flow title",
            summary: "Short summary.",
            steps: ["User opens signup", "System creates account"],
            deliveryGroupKeys: ["auth-frontend", "auth-backend"],
            screens: ["signup-page"],
          },
        ],
        scopeBoundaries: {
          inScope: [{ item: "User signup", deliveryGroupKey: "auth-backend" }],
          outOfScope: ["Password reset"],
        },
        deliveryGroups: [
          {
            key: "auth-backend",
            title: "Authentication Backend",
            summary: "Owns auth APIs.",
            ownedScreens: [],
            ownedResponsibilities: ["Create account endpoint"],
            dependsOn: [],
            mustStayTogether: true,
            mustNotSplit: false,
          },
        ],
        exitCriteria: [
          {
            criterion: "Signup API stores a session.",
            deliveryGroupKey: "auth-backend",
            screens: [],
          },
        ],
      },
      null,
      2,
    ),
    ...(input.hint?.trim()
      ? [
          "",
          "Repair guidance:",
          input.hint.trim(),
        ]
      : []),
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

export const buildMilestoneDesignRepairPrompt = (input: {
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
  issues: string[];
  draftJson: string;
  hint?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Repair the structured milestone design draft for "${input.milestoneTitle}" in "${input.projectName}".`,
    'Return valid JSON with exactly these top-level keys: "title", "objective", "includedUserFlows", "scopeBoundaries", "deliveryGroups", "dependenciesAndSequencing", and "exitCriteria".',
    "Preserve the milestone scope while resolving the validator issues below into one consistent ownership model.",
    "Do not introduce future-milestone work. Do not rename linked user flows. Do not leave the ambiguity unresolved.",
    "Do not invent future-milestone scope.",
    "For every screen named in includedUserFlows.screens or exitCriteria.screens, include that screen's owning delivery group in the same flow or exit criterion context.",
    "Keep scopeBoundaries.inScope, deliveryGroups, dependenciesAndSequencing, and exitCriteria aligned to one resolved interpretation of the milestone. If the previous draft or its risks chose one side of an ambiguity, carry that same choice through the repaired result.",
    "Do not leave an exit criterion, transition, ordering rule, or acceptance expectation that depends on anything listed in outOfScope.",
    "If GAME_OVER or another terminal state is mentioned, include only the in-scope trigger. Otherwise remove that transition from the repaired result.",
    "Do not wrap the JSON in code fences.",
    "Use this shape for tricky fields: steps must be an array of strings, outOfScope must be an array of strings, ownedScreens may be [], mustStayTogether and mustNotSplit must be booleans or string arrays, and backend-only exit criteria may use screens: [].",
    "",
    "Example JSON fragment:",
    JSON.stringify(
      {
        includedUserFlows: [
          {
            title: "Linked flow title",
            summary: "Short summary.",
            steps: ["User opens signup", "System creates account"],
            deliveryGroupKeys: ["auth-frontend", "auth-backend"],
            screens: ["signup-page"],
          },
        ],
        scopeBoundaries: {
          inScope: [{ item: "User signup", deliveryGroupKey: "auth-backend" }],
          outOfScope: ["Password reset"],
        },
        deliveryGroups: [
          {
            key: "auth-backend",
            title: "Authentication Backend",
            summary: "Owns auth APIs.",
            ownedScreens: [],
            ownedResponsibilities: ["Create account endpoint"],
            dependsOn: [],
            mustStayTogether: true,
            mustNotSplit: false,
          },
        ],
        exitCriteria: [
          {
            criterion: "Signup API stores a session.",
            deliveryGroupKey: "auth-backend",
            screens: [],
          },
        ],
      },
      null,
      2,
    ),
    ...(input.hint?.trim()
      ? [
          "",
          "Repair guidance:",
          input.hint.trim(),
        ]
      : []),
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
    "",
    "Validator issues:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Previous structured milestone design draft:",
    input.draftJson,
  ].join("\n");

export const buildMilestoneFeatureSetPrompt = (input: {
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
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the implementation-ready feature set for milestone "${input.milestone.title}" in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Create features only for the selected milestone.",
    "Use the approved planning documents and milestone design document to understand the current context.",
    "A feature must represent one coherent capability or one deliberately grouped cross-cutting workstream, not an implementation task, review step, or single document fragment.",
    "Build on work already planned in earlier or parallel milestones instead of recreating it.",
    "Do not repeat or lightly rename an existing feature from any milestone.",
    "Prefer the smallest set of coherent features that fully covers the milestone without overlap.",
    "Treat the milestone design document's Included User Flows and Delivery Shape groupings as hard boundary constraints.",
    "Each named flow step, screen, and responsibility in the milestone design document must belong to exactly one feature in the output.",
    "Cover every delivery group named in the milestone design document, including state-management or service groups that do not own screens.",
    "Make the feature set collectively satisfy every milestone exit criterion. Every exit criterion in the milestone design document must map to at least one feature acceptance criterion.",
    "If a delivery group owns a bundle of responsibilities, do not cover only the easiest subset. Rendering groups must cover the full named rendering scope, not just a single asset.",
    "Do not include acceptance criteria that depend on mechanics, collision checks, ordering rules, or behaviors that the milestone design document marks out of scope.",
    "When the milestone design document resolves a risk or ambiguity, use that one interpretation consistently across all generated features and acceptance criteria.",
    "Do not assign a responsibility to one feature while another feature explicitly says that responsibility is out of scope.",
    "If documentation, architecture follow-up, or another cross-cutting concern belongs together for this milestone, keep it in one shared feature instead of splitting it across multiple small features.",
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
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
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

export const buildMilestoneFeatureSetReviewPrompt = (input: {
  projectName: string;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  draftFeatures: Array<{
    title: string;
    summary: string;
    acceptanceCriteria: string[];
    kind: string;
    priority: string;
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and rewrite the draft feature set for milestone "${input.milestone.title}" in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Review the full set as a whole. Merge task-sized or overlapping features, close obvious milestone coverage gaps, and keep sibling features non-overlapping.",
    "Cross-check the set against the milestone design document's named flow steps, screens, and Delivery Shape groups before finalizing.",
    "Ensure every delivery group named in the milestone design document is covered, including non-visual groups with no screens.",
    "Ensure the reviewed set collectively satisfies every exit criterion from the milestone design document.",
    "Treat partial coverage as incomplete. If a rendering group owns grid, snake, and food rendering, do not approve a set that covers only food rendering.",
    "Remove or rewrite any acceptance criterion that depends on out-of-scope mechanics, collision checks, ordering rules, or future-milestone behavior.",
    "When the milestone design document resolves a risk or ambiguity, keep that one interpretation consistent across the whole reviewed set.",
    "Remove or rewrite any feature boundary that contradicts the milestone design document's ownership model.",
    "Prefer fewer, feature-sized items over many tiny items.",
    "Keep the result scoped only to the selected milestone.",
    "Do not wrap the JSON in code fences.",
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
    "",
    "First-pass draft feature set:",
    JSON.stringify(input.draftFeatures, null, 2),
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

const renderSiblingFeatures = (
  siblings: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>,
) => JSON.stringify(siblings, null, 2);

const renderRepairHint = (hint?: string | null) =>
  hint?.trim() ? ["Repair objective:", hint.trim(), ""] : [];

export const buildFeatureProductSpecPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  productSpec: string;
  technicalSpec: string;
  uxSpec: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    "Generate a feature-scoped Product Spec from the approved project Product Spec, UX Spec, and Technical Spec.",
    "Return valid JSON with top-level keys: \"title\", \"markdown\", and \"requirements\".",
    "The markdown must be detailed, implementation-oriented, and scoped only to the feature described below.",
    "The requirements object must contain boolean keys: uxRequired, techRequired, userDocsRequired, archDocsRequired.",
    "Use the milestone design doc and sibling feature list to keep ownership boundaries clear. Do not narrow the feature into a task-sized slice or expand it into neighboring feature scope.",
    "If this feature's title contains structural terms such as 'Foundation', 'Core', 'Shell', 'Scaffold', 'Bootstrap', or 'Setup', describe only the minimum owned capability required to support the milestone. Defer cross-cutting concerns such as offline handling, real-time sync, notification integration, or sibling-feature entry points unless the milestone design document explicitly places them here.",
    "Specify the primary success path in full before describing secondary branches, error states, or optional variants.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
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

export const buildFeatureProductSpecReviewPrompt = (input: {
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  draftTitle: string;
  draftMarkdown: string;
  requirements: {
    uxRequired: boolean;
    techRequired: boolean;
    userDocsRequired: boolean;
    archDocsRequired: boolean;
  };
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the feature Product Spec for "${input.feature.title}".`,
    'Return valid JSON with top-level keys: "title", "markdown", and "requirements".',
    "Preserve the intended feature scope while improving coverage, ownership boundaries, and consistency with the milestone design.",
    "Do not let the reviewed draft collapse into task-sized work or bleed into sibling features.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "First-pass feature Product Spec title:",
    input.draftTitle,
    "",
    "First-pass feature Product Spec markdown:",
    input.draftMarkdown,
    "",
    "First-pass feature Product Spec requirements:",
    JSON.stringify(input.requirements, null, 2),
  ].join("\n");

export const buildFeatureUxSpecPrompt = (input: {
  featureProductSpec: string;
  featureTitle: string;
  milestoneDesignDoc: string;
  projectProductSpec: string;
  projectUxSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the feature-scoped UX Spec for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Use the approved feature Product Spec as the main scope definition and the approved project UX Spec as the UX-system reference.",
    "Use the milestone design doc and sibling feature summaries to avoid drifting into neighboring feature scope.",
    "Focus exclusively on interaction design, layout, state transitions, copy, and accessibility decisions that are not already resolved in the feature Product Spec.",
    "Do not re-state product behavior, data models, API contracts, sync protocols, or backend rules already settled upstream. If a decision is already made in the Product Spec, reference it briefly rather than restating it at length.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
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
  milestoneDesignDoc: string;
  projectProductSpec: string;
  projectTechnicalSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the feature-scoped Technical Spec for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Use the approved feature Product Spec as the main scope definition and the approved project Technical Spec as the technical-system reference.",
    "Use the milestone design doc and sibling feature summaries to keep the implementation boundary clear.",
    "Focus exclusively on implementation decisions, data contracts, interface definitions, persistence requirements, and technical constraints that are not already resolved in the feature Product Spec.",
    "Do not re-state product behavior or UX decisions already settled upstream. If a decision is already made, reference it briefly rather than restating it at length.",
    "Do not include monitoring plans, rollout strategies, post-MVP roadmaps, enhancement ideas, or operational procedures unless they are directly required for the current feature implementation.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
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
  milestoneDesignDoc: string;
  projectProductSpec: string;
  projectUxSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate user-facing documentation for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Focus on user-facing behavior, setup expectations, and walkthrough guidance rather than implementation details.",
    "Keep documentation ownership aligned to this feature only. If related documentation belongs to a sibling feature, do not absorb it here.",
    "Document only stable, user-visible behavior that the product is ready to support publicly. Do not document implementation details, cryptographic specifics, backend timing guarantees, offline queueing mechanics, or speculative roadmap language.",
    "Do not describe sibling or future features unless they are already approved and directly required for a user to understand this feature.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Approved feature Product Spec:",
    input.featureProductSpec,
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
  ].join("\n");

export const buildFeatureArchDocsPrompt = (input: {
  featureTechSpec: string | null;
  featureTitle: string;
  milestoneDesignDoc: string;
  projectTechnicalSpec: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate internal architecture documentation for "${input.featureTitle}".`,
    "Return valid JSON with non-empty \"title\" and \"markdown\" keys.",
    "Focus on component boundaries, state ownership, interface contracts, data flow, and non-negotiable constraints that other engineers working in this area need to know.",
    "Keep the document scoped to this feature's owned architecture. Use the milestone design doc and sibling feature summaries to avoid duplicating another feature's architecture notes.",
    "Do not include speculative extension points, future considerations, observability planning, or operational rollout detail unless explicitly required by the upstream specs.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    ...(input.featureTechSpec
      ? ["Approved feature Technical Spec:", input.featureTechSpec, ""]
      : []),
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
  ].join("\n");

export const buildFeatureWorkstreamReviewPrompt = (input: {
  workstreamLabel: string;
  feature: {
    acceptanceCriteria: string[];
    featureKey: string;
    milestoneTitle: string;
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  siblingFeatures: Array<{
    featureKey?: string;
    title: string;
    summary: string;
  }>;
  draftTitle: string;
  draftMarkdown: string;
  hint?: string | null;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the ${input.workstreamLabel} for "${input.feature.title}".`,
    'Return valid JSON with non-empty "title" and "markdown" keys.',
    "Preserve the same feature scope while improving completeness, consistency, and ownership boundaries.",
    "Do not widen the scope into sibling features and do not collapse it into a task-sized fragment.",
    "If the draft re-states behavior already settled in the upstream feature Product Spec without adding discipline-specific decisions, revise it to focus only on what this workstream uniquely contributes.",
    "Do not wrap the JSON in code fences.",
    "",
    ...renderRepairHint(input.hint),
    "Feature context:",
    renderFeatureContext(input.feature),
    "",
    "Milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Sibling features in this milestone:",
    renderSiblingFeatures(input.siblingFeatures),
    "",
    `First-pass ${input.workstreamLabel} title:`,
    input.draftTitle,
    "",
    `First-pass ${input.workstreamLabel} markdown:`,
    input.draftMarkdown,
  ].join("\n");

export const buildMilestoneCoverageReviewPrompt = (input: {
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  features: Array<{
    acceptanceCriteria: string[];
    featureKey: string;
    workstreams: {
      product: "approved" | "missing" | "draft";
      ux: "approved" | "missing" | "draft";
      tech: "approved" | "missing" | "draft";
      userDocs: "approved" | "missing" | "draft";
      archDocs: "approved" | "missing" | "draft";
    };
    title: string;
    summary: string;
    taskCount: number;
    taskTitles: string[];
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review whether the planned work fully covers milestone "${input.milestone.title}".`,
    'Return valid JSON with exactly three keys: "complete" (boolean), "milestoneId" (string placeholder ignored by the prompt consumer), and "issues" (array).',
    'Each issue must be an object with exactly two keys: "action" and "hint".',
    '"action" must be either "rewrite_feature_set" or "needs_human_review".',
    "Only report material coverage gaps between the milestone design doc and the current feature/task plan.",
    "Be conservative. Do not report minor wording differences or implied detail that is already covered.",
    'Use "rewrite_feature_set" when the current milestone feature boundaries need to be rewritten to resolve the gap cleanly.',
    'Use "needs_human_review" when the gap is ambiguous, structural, or likely requires manual milestone or design changes.',
    'If the milestone design doc itself is coherent and the gap can be fixed by rewriting or expanding features, prefer "rewrite_feature_set".',
    'Use "needs_human_review" only when the milestone design doc still contains an unresolved contradiction or missing decision that prevents one consistent in-scope feature set.',
    "If coverage is complete, return complete=true and an empty issues array.",
    "Do not wrap the JSON in code fences.",
    "",
    "Milestone summary:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Canonical milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Current milestone features, workstream status, and task titles:",
    JSON.stringify(input.features, null, 2),
  ].join("\n");

export const buildRewriteMilestoneFeatureSetPrompt = (input: {
  issues: Array<{
    action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
    hint: string;
  }>;
  attemptNumber: number;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  currentMilestoneFeatures: Array<{
    title: string;
    summary: string;
  }>;
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  overviewDocument: string;
  projectName: string;
  projectProductSpec: string;
  projectTechnicalSpec: string;
  projectUxSpec: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Rewrite the full feature set for milestone "${input.milestone.title}" in "${input.projectName}" so it cleanly resolves the surfaced milestone coverage gap.`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "IMPORTANT: kind MUST be exactly one of these values with no variation: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "The output is the full replacement feature set for this milestone, not just the incremental fix.",
    "Rewrite sibling boundaries as needed so cross-feature interaction issues are handled inside the feature set itself.",
    "Prefer fewer, coherent feature-sized items over task-sized fragments.",
    "Resolve the named issues into one consistent ownership model across all features; do not restate the ambiguity in the rewritten set.",
    "Treat the milestone design document's Included User Flows and Delivery Shape groupings as hard constraints while rewriting.",
    "Each named flow step, screen, and responsibility in the milestone design document must belong to exactly one rewritten feature.",
    "Cover every delivery group named in the milestone design document, including state-management or service groups that do not own screens.",
    "Make the rewritten set collectively satisfy every milestone exit criterion. Every exit criterion in the milestone design document must map to at least one rewritten feature acceptance criterion.",
    "Treat partial coverage as incomplete. If a rendering group owns grid, snake, and food rendering, do not return a rewrite that covers only food rendering.",
    "Do not include rewritten acceptance criteria that depend on mechanics, collision checks, ordering rules, or behaviors listed as out of scope in the milestone design document.",
    "When the milestone design document resolves a risk or ambiguity, use that one interpretation consistently across the rewritten set.",
    "Keep the result scoped only to the selected milestone and avoid duplicating features from other milestones.",
    "Do not wrap the JSON in code fences.",
    "",
    "Coverage issues to close in this rewrite:",
    JSON.stringify(input.issues, null, 2),
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
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Current milestone feature set to replace:",
    JSON.stringify(input.currentMilestoneFeatures, null, 2),
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
  ].join("\n");

export const buildRewriteMilestoneFeatureSetReviewPrompt = (input: {
  issues: Array<{
    action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
    hint: string;
  }>;
  attemptNumber: number;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  currentMilestoneFeatures: Array<{
    title: string;
    summary: string;
  }>;
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  draftFeatures: Array<{
    title: string;
    summary: string;
    acceptanceCriteria: string[];
    kind: string;
    priority: string;
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the rewritten feature set for milestone "${input.milestone.title}".`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Preserve the intended full-set rewrite, close the named gap cleanly, and keep sibling feature ownership clear.",
    "Ensure the final rewrite uses one consistent interpretation of the milestone design document's flow order, screen ownership, and Delivery Shape boundaries.",
    "Ensure the final rewrite covers every delivery group named in the milestone design document, including non-visual groups with no screens.",
    "Ensure the final rewrite collectively satisfies every milestone exit criterion from the milestone design document.",
    "Treat partial coverage as incomplete. If a rendering group owns grid, snake, and food rendering, do not approve a rewrite that covers only food rendering.",
    "Remove or rewrite any acceptance criterion that depends on out-of-scope mechanics, collision checks, ordering rules, or future-milestone behavior.",
    "Merge overlapping or task-sized items back into coherent features.",
    "Do not wrap the JSON in code fences.",
    "",
    "Coverage issues to close in this rewrite:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Current milestone feature set to replace:",
    JSON.stringify(input.currentMilestoneFeatures, null, 2),
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
    "",
    "First-pass rewritten feature set:",
    JSON.stringify(input.draftFeatures, null, 2),
  ].join("\n");

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
    "Apply the clarification answers as narrowing constraints. If an answer confirms a simpler approach, eliminates a branch, or defers optional behavior, remove or reduce the corresponding task scope. The task list should be shorter and more focused after clarifications than a naive reading of the feature specs alone would produce.",
    "Order tasks in implementation sequence: setup, core logic, integration, testing.",
    "Prefer the smallest set of coherent implementation phases that can deliver this feature safely. Do not split the work into micro-tasks just because the steps are individually small.",
    "Merge tightly related coding, testing, and documentation work when they belong to the same implementation phase.",
    "Instructions should provide concrete guidance for how to implement.",
    "Ensure the full task list covers the feature acceptance criteria and any required testing, integration, migration, or documentation work implied by the specs.",
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

export const buildMilestoneCoverageRepairPrompt = (input: {
  issues: Array<{ action: "needs_human_review"; hint: string }>;
  attemptNumber: number;
  previousUnresolvedReasons?: string[];
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  features: Array<{
    featureKey: string;
    title: string;
    summary: string;
    acceptanceCriteria: string[];
    taskTitles: string[];
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Resolve the milestone coverage gaps for milestone "${input.milestone.title}" without editing the milestone design document itself.`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    'Return valid JSON with exactly four top-level keys: "resolved" (boolean), "defaultsChosen" (array), "operations" (array), and "unresolvedReasons" (array).',
    'Each defaultsChosen item must contain exactly: "issueIndex", "decision", "rationale".',
    'Each operations item must contain exactly: "featureKey", "featurePatch", "refresh", and "hint".',
    'featurePatch must be either null or an object with exactly: "title", "summary", "acceptanceCriteria".',
    'refresh must be an object with exactly these boolean keys: "product", "ux", "tech", "userDocs", "archDocs", "tasks".',
    "Use only existing features from the selected milestone. Do not add, remove, move, or merge features.",
    "Choose conservative defaults that satisfy the milestone design document and keep work inside the active milestone.",
    "If the gaps cannot be resolved with updates to existing feature definitions, workstreams, and tasks, return resolved=false and explain why in unresolvedReasons.",
    "Do not wrap the JSON in code fences.",
    "",
    `Valid featureKey values for operations (use ONLY these exact strings): ${JSON.stringify(input.features.map((f) => f.featureKey))}`,
    "",
    "Example of a valid operation:",
    JSON.stringify({
      featureKey: "F-001",
      featurePatch: { title: "Updated title", summary: "Updated summary", acceptanceCriteria: ["Criterion 1"] },
      refresh: { product: true, ux: false, tech: false, userDocs: false, archDocs: false, tasks: false },
      hint: "Expanded feature scope to cover missing authentication flow",
    }, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Canonical milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Coverage gaps to resolve:",
    JSON.stringify(input.issues, null, 2),
    "",
    ...(input.previousUnresolvedReasons?.length
      ? [
          "Previous unresolved reasons from the prior repair attempt:",
          JSON.stringify(input.previousUnresolvedReasons, null, 2),
          "",
        ]
      : []),
    "Current active-milestone features and task titles:",
    JSON.stringify(input.features, null, 2),
  ].join("\n");

export const buildMilestoneCoverageRepairReviewPrompt = (input: {
  milestone: {
    summary: string;
    title: string;
  };
  attemptNumber: number;
  milestoneDesignDoc: string;
  issues: Array<{ action: "needs_human_review"; hint: string }>;
  previousUnresolvedReasons?: string[];
  draftPlan: {
    resolved: boolean;
    defaultsChosen: Array<{
      issueIndex: number;
      decision: string;
      rationale: string;
    }>;
    operations: Array<{
      featureKey: string;
      featurePatch: {
        title: string;
        summary: string;
        acceptanceCriteria: string[];
      } | null;
      refresh: {
        product: boolean;
        ux: boolean;
        tech: boolean;
        userDocs: boolean;
        archDocs: boolean;
        tasks: boolean;
      };
      hint: string;
    }>;
    unresolvedReasons: string[];
  };
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and tighten the milestone coverage repair plan for milestone "${input.milestone.title}".`,
    `This is milestone coverage auto-repair attempt ${input.attemptNumber}.`,
    'Return valid JSON with exactly four top-level keys: "resolved", "defaultsChosen", "operations", and "unresolvedReasons".',
    "Keep the plan conservative, executable, and limited to existing active-milestone features.",
    "Do not invent milestone-document changes or cross-milestone work.",
    "If the draft plan is overreaching, reduce it or set resolved=false.",
    "Do not wrap the JSON in code fences.",
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Canonical milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Coverage gaps to resolve:",
    JSON.stringify(input.issues, null, 2),
    "",
    ...(input.previousUnresolvedReasons?.length
      ? [
          "Previous unresolved reasons from the prior repair attempt:",
          JSON.stringify(input.previousUnresolvedReasons, null, 2),
          "",
        ]
      : []),
    "First-pass repair plan:",
    JSON.stringify(input.draftPlan, null, 2),
  ].join("\n");

export const buildDeliveryReviewPrompt = (input: {
  projectName: string;
  productSpec: string;
  userFlows: Array<{ title: string; userStory: string }>;
  milestones: Array<{ title: string; summary: string; featureCount: number }>;
  coverage: {
    approvedUserFlowCount: number;
    coveredUserFlowCount: number;
    uncoveredUserFlowTitles: string[];
  };
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
    "Issues must be ordered by priority: milestone issues first, user flow issues second.",
    "Milestone-to-user-flow coverage is provided as authoritative structured data below.",
    "Do not infer missing milestone coverage from milestone prose when the coverage summary shows all approved user flows are already covered.",
    "Do not wrap the JSON in code fences.",
    "",
    "Checks to perform (evaluate in this order — stop at the first failing check):",
    "1. Milestones — do the milestones provide a coherent, complete delivery plan that covers all approved user flows?",
    "   Because every project in this workflow is greenfield, milestone 1 must be a real foundations/setup milestone.",
    "   Fail milestone review if milestone 1 does not establish project scaffolding such as AGENTS.md, repo structure, baseline docs/ADR scaffolding, environment/bootstrap, CI/test harness, and a minimal smoke-path.",
    "   Each user flow should map to at least one milestone. Look for user flows that no milestone addresses.",
    "   Milestones with featureCount > 0 are actively being implemented — treat them as in-progress delivery.",
    "   If any user flows are uncovered by milestones, raise a GenerateMilestones issue (not GenerateUseCases).",
    "2. User Flows — only check this if milestones already cover all current user flows.",
    "   Are there fundamentally important journeys missing from the product spec that are not represented at all?",
    "   Be conservative: only flag a genuine gap (e.g. no onboarding flow exists at all, no error-recovery flow exists at all).",
    "   Do NOT flag minor variations, edge cases, or flows that are implied by existing ones.",
    "   Do NOT flag user flow gaps if the milestone plan does not yet cover the existing flows — fix milestones first.",
    "3. Overall — given the above, is the planning complete enough to begin or continue implementation?",
    "   Prefer returning complete: true when coverage is reasonable. Only return complete: false for clear, actionable gaps.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    "",
    "Approved User Flows:",
    JSON.stringify(input.userFlows, null, 2),
    "",
    "Authoritative milestone coverage summary:",
    JSON.stringify(input.coverage, null, 2),
    "",
    "Approved Milestones (featureCount = number of features already created for that milestone):",
    JSON.stringify(input.milestones, null, 2),
  ].join("\n");
