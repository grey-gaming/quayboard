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
    "Approved Product Spec:",
    input.sourceMaterial,
  ].join("\n");
