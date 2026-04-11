import type { ProjectSizeProfile } from "../../project-sizer.js";

import { renderProjectScaleGuidance } from "./shared.js";

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

Commit to product decisions throughout the specification — including reasonable inferences about core capabilities, workflows, and product shape. Stated requirements take priority, but core product direction and user model may be owned throughout the document even when inferred from context. Where you extend into non-obvious scope expansions, optional platform capabilities, or integrations beyond the stated direction, place those in the Assumptions and Proposed Defaults section — do not embed them in the main spec body as confirmed requirements.

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
- Write as a committed product authority. Make product decisions and own them — do not hedge or present alternatives. Scope extensions belong in Assumptions and Proposed Defaults, not scattered through the spec body as uncertainty.

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
  sizeProfile?: ProjectSizeProfile;
  hint?: string;
}) =>
  [
    `Create a complete Product Spec for "${input.projectName}".`,
    'Return valid JSON with exactly two top-level string keys: "title" and "markdown".',
    'The "markdown" value must contain the full product specification.',
    "Do not wrap the JSON in code fences.",
    "",
    productSpecPrompt,
    ...(input.sizeProfile
      ? [
          "",
          renderProjectScaleGuidance(input.sizeProfile),
        ]
      : []),
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
    "- ensure scope extensions and non-obvious capabilities are in the Assumptions and Proposed Defaults section rather than embedded throughout the spec body as if they were confirmed requirements; the main spec should read as a committed product direction",
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
