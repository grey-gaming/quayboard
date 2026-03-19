# Quayboard — Project Outline

> A comprehensive plan for teams building Quayboard, covering the product vision, UX architecture, technical architecture, and a phased delivery roadmap.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [UX Architecture](#2-ux-architecture)
3. [Technical Architecture](#3-technical-architecture)
4. [Delivery Roadmap](#4-delivery-roadmap)
5. [Glossary](#5-glossary)

---

## 1. Project Overview

### 1.1 One-line summary

Quayboard is a web-based control plane for managing software projects and orchestrating agentic coding runs — with structured governance, stage-gated automation, traceability, and evidence capture.

### 1.2 Problem statement

AI coding agents can deliver high-quality changes when given clear scope and constraints, but teams struggle to operationalize them safely across multiple repositories and projects. Without a workflow layer, agents receive vague prompts, produce unscoped changes, and leave no audit trail. Reviews happen ad hoc and mistakes compound.

Quayboard provides the workflow, policy, and audit layer that turns "a prompt" into repeatable, governable delivery: an ordered work queue, constrained execution, PR-first outputs, and reviewable evidence — all within a single control plane.

### 1.3 Vision and goals

**Vision**: Make AI-assisted software delivery as governable and auditable as any other engineering practice — with humans in control of intent, quality gates, and approvals.

**Goals**:

- Guide teams from a rough project idea to a structured, LLM-generated overview document, project blueprint (UX and tech), and ordered feature backlog.
- Automate low-risk transitions between planning stages while surfacing blockers for human review.
- Execute work inside isolated sandboxes governed by per-project tool policies — with action-level enforcement, budget controls, and full invocation audit trails — producing PRs as the primary deliverable.
- Capture durable evidence for every run: inputs, diffs, logs, test results, context snapshots, and links to PRs.
- Provide portfolio visibility so leadership, architects, and delivery managers can monitor, approve, and intervene at any level.

### 1.4 Product principles

1. **Evidence-first and auditable** — Every sandbox run produces a durable trail: inputs, context snapshot (bounded), repo baseline SHA, diffs, logs, test reports, and links to PRs or artifacts.
2. **PR-first delivery** — Code changes are proposed via pull requests with clear intent and evidence attached, never pushed directly to a branch without review.
3. **Governance by default** — Explicit approvals for elevated actions, budget/stop conditions, deny-by-default network egress (with allowlists where needed), and quality gates before stage transitions.
4. **Tool-governed capabilities** — Every capability available to LLM jobs or external agents is a registered tool with an action level, schema, and policy check. Models propose tool usage; the system validates and executes. Server-side enforcement means the LLM cannot self-authorise.
5. **Data-driven UX and content** — Question sets, templates, document sections, and generation modes are configuration-driven, not hard-coded.
6. **No tool-owned state in target repositories** — Quayboard never creates hidden folders (e.g., `.agents/`) in managed repos. It tracks repo state via last-seen commit SHA and maintains its own bounded internal memory. Any artifact committed to a repo happens through an explicit, human-approved PR.
7. **Bounded context** — Context packs are carefully sized summaries, not raw dumps. Context caps are enforced aggressively to keep LLM calls focused.
8. **Tight, single-purpose jobs** — Each LLM job type is narrow. Broad "do everything" orchestrators are built from composable, independently testable units.
9. **Deterministic CI** — All LLM integrations are mockable. Tests never require a live LLM connection.

### 1.5 Primary users

| Persona | Primary concerns |
|---|---|
| **Product / Leadership** | Portfolio visibility, cost control, risk, approvals at a glance |
| **Engineering leads / Architects** | Standards enforcement, review gates, architectural decisions, policy |
| **Delivery / Project managers** | Ordering, milestones, progress tracking, unblocking |
| **QA / Reviewers** | Consuming evidence, quality gate outcomes, acceptance decisions |

### 1.6 Non-goals (MVP)

- Replacing GitHub Issues / Projects / Jira entirely.
- Fully autonomous deployment to production without human approvals.
- Running untrusted third-party code without stronger isolation (microVMs are a future concern).
- Writing tool-owned planning state into target repositories as hidden folders.

### 1.7 Success criteria

- Onboard a project quickly: structured overview document, repositories, and policies in minutes.
- Produce a high-quality, LLM-assisted overview document and at least one coherent feature.
- Create and store an ordered work queue (milestones + features + tasks) in Quayboard.
- Execute at least one work item end-to-end, producing a PR with clear evidence attached.
- Provide portfolio visibility and audit trails suitable for leadership review.

---

## 2. UX Architecture

### 2.1 Design language

Quayboard uses a purpose-built dark theme called **Harbor Night**.

- **Palette**: Neutrals for structure; restrained accent colours for status indicators and primary actions. No decorative colour — every colour carries meaning.
- **Accessibility**: Font scaling, contrast ratios, and responsive layouts are first-class requirements across mobile to desktop breakpoints.
- **Tone**: Professional, minimal, and direct. No marketing copy inside the product. Empty states explain what to do next, not how great the product is.
- **Iconography**: `lucide-react` icon set throughout.

### 2.2 Information architecture

The top-level navigation divides into:

```
Home (project list)
└── Project
    ├── Mission Control (project landing page: stage map, next actions, timeline/evidence feed)
    ├── Project Setup (repo access, LLM provider, sandbox defaults, evidence policy)
    ├── Overview Document (questionnaire -> document)
    ├── Product Spec (overview -> full specification)
    ├── Blueprint (decision deck -> UX/tech project blueprints)
    ├── Milestones (lifecycle: draft -> approved -> completed)
    ├── Features (catalogue / editor)
    │   └── Feature Editor
    │       ├── Product specification tab
    │       ├── UX specification tab
    │       ├── Tech specification tab
    │       ├── User documentation tab
    │       ├── Architecture documentation tab
    │       ├── Tasks tab
    │       └── Bugs tab
    ├── Develop (sandbox runner, container management, artifacts)
    └── Analytics (per-project LLM usage, velocity, quality metrics)

Settings
├── Models (per-activity LLM selection)
├── Workflow (review-loop controls)
└── Execution (sandbox configuration)

Jobs (global job history)
```

Mission Control is the default project landing page (`/projects/:id`). It absorbs the phase summary previously shown on a separate "Project Detail" page. All other project pages are focused editors that plug into Mission Control's orchestration surface.

### 2.3 Screen map

| Route | Screen | Purpose |
|---|---|---|
| `/` | **Home** | Project list with status badges, filter bar, empty state, error state |
| `/setup/instance` | **Instance Readiness** | First-run deployment checks: database, encryption key, Docker, artifact storage, enabled provider adapters |
| `/projects/new` | **New Project** | Create from scratch or import chooser |
| `/projects/:id` | **Mission Control** | Project landing page: stage map, next actions, auto-advance controls, timeline/evidence feed, phase summary |
| `/projects/:id/setup` | **Project Setup** | Repo access (PAT/OAuth), LLM provider config, sandbox defaults, and evidence policy |
| `/projects/:id/import` | **Import Project** | GitHub / local file import |
| `/projects/:id/questions` | **Questions** | Questionnaire editing, autosave, and LLM blank-answer generation |
| `/projects/:id/one-pager` | **Overview Document** | Generated overview review, history, restore, and approval |
| `/projects/:id/product-spec` | **Product Spec** | Generated Product Spec review, history, restore, and approval |
| `/projects/:id/user-flows` | **User Flows** | Generate, edit, deduplicate, and approve user journeys with coverage feedback |
| `/projects/:id/blueprint` | **Blueprint Builder** | Decision deck, UX/tech project blueprint review |
| `/projects/:id/milestones` | **Milestones** | Create, edit, approve, complete milestone lifecycle |
| `/projects/:id/features` | **Feature Builder** | Catalogue table view, intake drawer |
| `/projects/:id/features/:fid` | **Feature Editor** | Product / UX / tech / user docs / architecture docs specification tabs, tasks tab, bugs tab, review panel, revision history |
| `/projects/:id/features/:fid/tasks` | **Feature Tasks** | Standalone task planning view: clarification questions, generated delivery task list |
| `/projects/:id/develop` | **Develop** | Sandbox run launcher, artifact viewer, container management |
| `/projects/:id/develop/debug` | **Develop Debug** | Developer-only context-pack inspection, staleness checks, and regeneration controls |
| `/projects/:id/analytics` | **Project Analytics** | Per-project LLM usage, velocity, and quality metrics |
| `/settings/models` | **Model Settings** | Optional defaults and diagnostics after M2; active model selection for MVP lives in Project Setup |
| `/settings/workflow` | **Workflow Settings** | Review-loop and auto-advance controls |
| `/settings/execution` | **Execution Settings** | Sandbox runner configuration |
| `/settings/templates` | **Template Settings** | Create, edit, and manage reusable project templates |
| `/jobs` | **Jobs** | Global async job history and status monitoring |
| `/analytics` | **Analytics Dashboard** | Cross-project LLM usage, velocity, and quality metrics (M14) |
| `/audit-log` | **Audit Log** | Searchable, paginated audit trail of all system events (M14) |
| `/search` | **Search Results** | Full-text search results with faceted filtering (M16) |

### 2.4 Key user flows

#### Flow -1: Instance readiness and first run

1. User opens the login or registration screen.
2. Quayboard checks deployment prerequisites that exist outside any project before auth submission is allowed:
   a. Database connectivity.
   b. `SECRETS_ENCRYPTION_KEY` presence.
   c. Docker daemon reachability.
   d. Artifact storage path writability.
   e. Enabled LLM provider adapters.
3. Any failing check shows a concrete remediation message and blocks registration and sign-in until the instance is green.
4. After the checks pass, the user registers or logs in.
5. The screen does not collect project credentials. Repo PATs and LLM API keys are configured only later in **Project Setup**.

#### Flow 0: Project setup and guided onboarding

1. User creates a project (name + optional description).
2. User enters the **Project Setup** page and completes the readiness checklist:
   a. **Connect repository** — provide a GitHub PAT or initiate OAuth, select a repo. Quayboard verifies access.
   b. **Configure LLM provider** — select one of the enabled provider adapters for this project, enter the project-scoped API key or endpoint override when required, choose models for activity types, and verify connectivity.
   c. **Configure sandbox defaults** — set timeouts, CPU/memory limits, network egress policy (locked / allowlisted), and verify sandbox startup.
   d. **Set evidence and docs policy** — choose which artifact types require documentation before milestone completion.
   e. **Save and verify setup sections** — repository, LLM, and sandbox state is surfaced inline within each setup section.
   f. **Complete Setup** — once the required checks pass, the user explicitly marks setup complete. Overview and later planning sections stay locked until this action is confirmed.
3. On first project, a guided **"Hello World" onboarding** path walks the user through the full pipeline:
   - Clear instance readiness → register or log in → create project → connect repo → verify LLM → verify sandbox → complete questionnaire and overview document.
   - The full pipeline demo continues in M8, where sandbox execution, PR creation, and evidence bundles are implemented.

#### Flow 1: New project — scratch to overview document

1. User clicks **New Project** and selects **Start from scratch**.
2. Completes a 14-question guided questionnaire on the **Questions** page (config-driven question keys: `q1_name_and_description` through `q14_product_feel`), with autosave and optional LLM blank-answer generation.
3. User clicks **Next: Generate Overview** to move to the overview screen.
4. LLM generates the **overview document** (versioned, restorable) and refreshes the saved project description.
5. User reviews the overview document, triggers targeted regenerations or section improvements.
6. User approves the overview document — phase gate passes.

#### Flow 2: Product Spec

1. After the overview document is approved, user enters **Product Spec**.
2. Quayboard generates the Product Spec from the approved overview using the Product Spec prompt.
3. The Product Spec is versioned, editable, restorable, and must be approved before User Flows.

#### Flow 3: User-flow coverage and approval

1. After the Product Spec is approved, user enters **User Flows**.
2. Quayboard can generate an initial set of user flows from the approved Product Spec, or the user can create flows manually.
3. Each flow captures title, user story, entry point, end state, flow steps, coverage tags, acceptance criteria, and done-criteria references.
4. Quayboard computes a **coverage summary** over the active flow set and highlights warnings or missing journey areas.
5. If coverage gaps remain, Quayboard can run a targeted gap-fill generation pass and a deterministic dedupe pass before approval.
6. User reviews, edits, archives, or approves the user-flow set. Blueprint generation is gated on approved user flows.

#### Flow 4: Blueprint phase

1. From Mission Control, user enters the Blueprint phase.
2. LLM generates a **decision deck** (key architectural and UX decisions with recommendations and alternatives).
3. User reviews each decision card and selects an option (or enters a custom choice).
4. LLM generates **project blueprints** (UX and tech).
5. LLM review jobs surface BLOCKER / WARNING / SUGGESTION items.
6. User triages review items — sets to DONE, ACCEPTED, or IGNORED.
7. Blueprints can also be saved directly through the API or MCP when manual authoring is preferable.
8. All BLOCKERs resolved — user approves the project blueprints.

#### Flow 4: Milestones and features

1. LLM proposes milestone structure (e.g., Milestone 0: Foundations, Milestone 1: Hello World, ...) using approved user flows as the primary release contract.
2. User approves milestones — each moves from `draft` to `approved`.
3. User enters the **Feature Builder** to create features.
4. Features can be created manually or seeded from the overview document via LLM; recommendation and append flows deduplicate against existing project scope to avoid repeated foundation work.
5. Each feature has five workstream tracks: **product specification**, **UX specification**, **tech specification**, **user documentation**, **architecture documentation**.
6. Each workstream goes through: draft, reviewed, approved.
7. Dependencies between features are wired up to form a build-order graph.

#### Flow 5: Task planning and feature-level sandbox execution

1. With an approved tech specification, user triggers **task clarification generation**.
2. Clarification questions are answered (manually or via LLM auto-answer).
3. LLM generates a **delivery task list** — ordered, scoped work items, with existing project tasks passed into generation to reduce duplicates.
4. Task plan is stress-tested by the LLM quality gate.
5. User launches a **sandbox run** in the Develop page — all pending tasks for a feature are bundled and executed together in a single `ImplementChange` run inside an isolated container, followed by a shared `TestAndVerify` verification run. The coding agent inside the container is **OpenCode** (a headless agentic code editor).
6. Verification runs can warm-start from the implementation worktree, carry forward structured remediation context from failed commands, and apply bounded writable fixes when needed.
7. Clean no-op implementation runs are treated as terminal success rather than false failures.
8. Each feature implementation run produces a single PR plus artifacts (logs, diffs, test reports). On successful verification, all bundled tasks are marked complete atomically.

#### Flow 6: Mission Control auto-advance

1. User enters Mission Control (the project landing page) and starts **auto-advance** with optional `autoApproveWhenClear`, `skipReviewSteps`, and `creativityMode` settings.
2. The system progresses through stages automatically — project setup readiness, overview document, user flows, project blueprints, milestones, features, documentation, tasks — pausing at human review points or when quality gates raise blockers.
3. User can pause, resume, reset runtime state, or step through one action at a time.
4. The tube-map stage visualiser shows current stage and completion status at a glance.
5. Mission Control surfaces **implementation staleness** — if a feature's approved tech specification has changed since it was last implemented, it appears as a next-action item ("Re-implement feature").

#### Flow 7: Bug report and fix verification

1. During review of a sandbox run or PR, a user files a **bug report** linked to the feature, implemented tech revision, sandbox run, and PR.
2. The bug report captures an environment snapshot (model, provider, policy settings at time of the run).
3. A fix is applied — either by spawning a new fix task set or creating a new feature revision.
4. The fix is verified by a **verification sandbox run**, passing tests, or reviewer approval.
5. Closing a bug requires evidence: the verification run ID, test results, or an explicit reviewer sign-off.

### 2.5 Design system

The frontend uses a layered, purpose-built design system:

| Layer | Location | Examples |
|---|---|---|
| **Foundations** | Tailwind config, CSS variables | Colours, spacing, typography, radius tokens |
| **Primitives** | `components/ui/` | `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Select`, `Checkbox`, `Spinner`, `Skeleton`, `Alert`, `Toast`, `Label`, `Dialog`, `Drawer`, `Popover`, `Tabs` |
| **Composites** | `components/composites/` | `CenteredState` (loading/error/empty), `PageIntro` (section header), `WorkspaceTopBar` (sticky bar) |
| **Templates** | `components/templates/` | `StandalonePage` (full-height single-column), `AppFrame` (shell wrapper) |
| **Layout** | `components/layout/` | `Layout`, `PrimaryBar` (sidebar nav), `ProjectSubNav`, `GlobalHeader`, `DebugStatusBar` |
| **Workflow** | `components/workflow/` | `ReviewPanel`, `NextActionBar`, `TransitionConfirmDialog`, `PhaseGateChecklist`, `StateMachineVisualizer` |

**Critical rule**: Page files (`pages/**`) must never use raw `<button>`, `<input>`, `<select>`, or `<textarea>` HTML elements. DS primitives are required throughout.

### 2.6 Project Context Header

A compact, sticky header strip (`ProjectContextHeader`) is shown on every project-scoped page. It provides persistent at-a-glance context without navigating away from the current editor:

| Slot | Content |
|---|---|
| **Project state** | Current phase + phase gate status (e.g., "Blueprint — 2/3 gates passed") |
| **Repository** | Connected repo name(s) + last-seen SHA (truncated) |
| **Model profile** | Active LLM models (planning/review/coding) + provider status (`connected` / `degraded` / `offline`) |
| **Sandbox policy** | Egress policy (`locked` / `allowlisted`), resource limits summary |
| **Tool policy** | Active tool groups (e.g., "planning + review"), budget consumption indicator (e.g., "Budget: 42% used") — skeleton slot in M2, populated from M10 |
| **Setup readiness** | Green/amber/red indicator reflecting the Project Setup readiness checklist |

The header is part of the Layout layer (`components/layout/ProjectContextHeader`) and is rendered inside the `AppFrame` when a project is selected.

### 2.7 Standardised review layout pattern

All artifact types (overview document, project blueprint, feature specifications, user documentation, architecture documentation, delivery tasks) use a single, universal review layout:

| Position | Component | Content |
|---|---|---|
| **Left** | Artifact content | Editor or markdown preview of the artifact under review |
| **Right** | `ReviewPanel` | Review items grouped by severity (`BLOCKER` → `WARNING` → `SUGGESTION`) and category |
| **Bottom** | `NextActionBar` | Contextual actions: regenerate, refine from issues, approve, advance phase |

The action verbs, status labels, and severity badges are identical across all artifact types. This consistency means users learn the review workflow once and apply it everywhere. The pattern is implemented in the Workflow layer (`components/workflow/`).

Reference documentation:
- `docs/design-system/ui-estate-catalogue.md` — full inventory of all pages and components
- `docs/design-system/taxonomy.md` — normalised layer taxonomy
- `docs/design-system/visual-spec-v1.md` — visual design specification

---

## 3. Technical Architecture

### 3.1 Monorepo structure

```
quayboard/
├── apps/
│   ├── api/                        # Fastify backend (Node.js)
│   │   └── src/
│   │       ├── routes/             # HTTP endpoint handlers (one file per resource area)
│   │       ├── services/           # Business logic, job scheduler, executors
│   │       │   ├── job-executors/  # Per-job-type LLM executor modules
│   │       │   └── automation-quality/ # Quality gate executors
│   │       ├── db/                 # Drizzle schema and SQL migrations
│   │       └── prompts/            # Versioned LLM prompt templates (markdown)
│   ├── web/                        # Vite + React frontend
│   │   └── src/
│   │       ├── pages/              # Page components (by route)
│   │       ├── components/         # DS primitives, composites, templates, layout, workflow
│   │       ├── hooks/              # Custom React hooks
│   │       └── lib/                # API client modules, SSE, utilities
│   └── mcp/                        # Model Context Protocol server
│       └── src/
│           ├── tools/              # MCP tool definitions wrapping the Quayboard API
│           └── index.ts            # MCP server entry point
├── packages/
│   └── shared/                     # Shared Zod schemas and TypeScript types
│       └── src/schemas/
├── docs/
│   ├── adr/                        # Architecture Decision Records
│   ├── design-system/              # UI estate catalogue, taxonomy, visual spec
│   ├── user/                       # User-facing documentation (guides, help text, API docs)
│   ├── architecture/               # Internal architecture documentation (design rationale, data flow)
│   └── {sprint-docs}/              # Per-sprint specification and planning docs
└── docker-compose.yml              # Postgres service for local development
```

### 3.2 Tech stack

#### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18 | UI library |
| **Vite** | 6 | Build tool and dev server |
| **React Router** | 7 | Client-side routing |
| **Tailwind CSS** | 3 | Utility-first styling |
| **TanStack Query** | 5 | Data fetching, caching, and server-state management |
| **react-hook-form** | — | Form state management |
| **react-markdown** | — | Markdown rendering |
| **lucide-react** | — | Icon library |
| **Zod** | 3 | Runtime schema validation |

#### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Fastify** | 5 | HTTP API framework |
| **Drizzle ORM** | — | Type-safe database access and migration tooling |
| **PostgreSQL** | 15+ | Primary database (dev, integration, prod) |
| **SQLite** | — | Database for fast unit tests (no Docker required) |
| **better-sqlite3** | — | SQLite driver for unit tests |
| **Zod** | 3 | Request/response validation |
| **tsx** | — | TypeScript executor for development |

#### Infrastructure and tooling

| Technology | Purpose |
|---|---|
| **pnpm** (workspaces) | Package management and monorepo orchestration |
| **TypeScript** 5.7 | Type safety across the entire stack |
| **Vitest** | Unit and integration testing |
| **Playwright** | End-to-end browser testing |
| **Docker Compose** | Local Postgres and auxiliary services |
| **Ollama** | Local LLM provider (optional for development) |

### 3.3 Database schema

The database uses PostgreSQL in production and SQLite for unit tests. All tables are managed via Drizzle ORM with manual SQL migrations tracked in `apps/api/drizzle/`.

#### Core project tables

| Table | Purpose |
|---|---|
| `projects` | Project metadata, phase state (`EMPTY -> BOOTSTRAPPING -> READY`), name confirmation, user-flow approval metadata |
| `project_counters` | Auto-incrementing feature/task sequence counters per project |
| `repos` | Repository references (GitHub/GitLab/local), last-seen SHA, sync control |
| `one_pagers` | Versioned overview documents with canonical pointer |
| `questionnaire_answers` | Persisted answers to the 14 questionnaire questions |
| `use_cases` | Internal storage for user-facing user flows, including coverage tags, flow steps, and approval readiness |
| `decision_cards` | Decision deck cards with LLM recommendations, alternatives, and user selections |
| `project_blueprints` | UX and tech project blueprint documents (versioned, canonical pointer) |

#### Workflow and planning tables

| Table | Purpose |
|---|---|
| `milestones` | Milestone lifecycle (`draft -> approved -> completed`) |
| `milestone_use_cases` | Links approved user flows to milestones so release planning stays tied to journey coverage |
| `milestone_design_docs` | Versioned milestone design documents |
| `auto_advance_sessions` | Auto-advance session lifecycle: status (`active / paused / completed / failed`), automation flags (`auto_approve_when_clear`, `skip_review_steps`), failure counters, paused reason, timestamps |
| `logbook_versions` | Project memory snapshots with coverage flags |
| `memory_chunks` | Bounded context summaries: repo tree, docs summaries, subsystem summaries |
| `context_packs` | Immutable context snapshots tagged by legacy profile and by pack type (`planning` or `coding`), with omission lists, char/token counts, and source coverage metadata |

#### Feature tables

| Table | Purpose |
|---|---|
| `feature_cases` | Feature identity node in the dependency graph |
| `feature_revisions` | Immutable content snapshots (title, summary, acceptance criteria) |
| `product_specs` / `product_revisions` | Product specification with workstream requirement flags |
| `ux_specs` / `ux_revisions` | UX specification markdown (versioned) |
| `tech_specs` / `tech_revisions` | Tech specification markdown (versioned) |
| `feature_edges` | Rich typed relationships between features (`leads_to`, `depends_on`, `contains`) — used for graph visualisation and navigation. Distinct from `feature_dependencies`, which is the simpler direct-link table used by the build-order system and auto-advance. This table is populated automatically when `feature_dependencies` entries are created and is read-only via the API; all consumer graph reads use `GET /projects/:id/features/graph`. |
| `feature_dependencies` | Simple, direct dependency links (feature A depends on feature B) — the primary table used by the build-order system, auto-advance, and dependency validation. This is the table the API and MCP tools read and write. |
| `feature_issues` | Architectural review findings on features (severity, category, status) |
| `artifact_issues` | Direct-create review findings for lightweight scenarios where a full review run is not required. New review findings from LLM review jobs are written to `artifact_review_items` via `artifact_review_runs`; this table covers manually filed findings. |
| `artifact_review_runs` | Review job execution records with quality gate state |
| `artifact_review_items` | Individual review findings from a review run (`BLOCKER / WARNING / SUGGESTION`). This is the primary table for the review workflow. |
| `artifact_approvals` | Approval records linking artifact to approver and timestamp |
| `implementation_records` | Links a feature to the implemented tech revision and commit SHA |

#### Documentation tables

| Table | Purpose |
|---|---|
| `user_doc_specs` | User documentation specification identity per feature (head revision pointer) |
| `user_doc_revisions` | Immutable user documentation revision snapshots (markdown, versioned) |
| `arch_doc_specs` | Architecture documentation specification identity per feature (head revision pointer) |
| `arch_doc_revisions` | Immutable architecture documentation revision snapshots (markdown, versioned) |

#### Bug report tables

| Table | Purpose |
|---|---|
| `bug_reports` | Bug reports linked to feature, tech revision, sandbox run, PR, environment snapshot. Status: `open / in_progress / fixed / verified / closed / wont_fix`. Reporter and assignee user IDs. |
| `bug_fix_tasks` | Fix task items generated for a bug report (links bug report ID to a set of ordered fix tasks) |

#### Task planning tables

| Table | Purpose |
|---|---|
| `feature_task_planning_sessions` | Task planning session lifecycle |
| `feature_task_clarifications` | Generated clarification questions |
| `feature_task_clarification_answers` | User or auto-answered clarification responses |
| `feature_delivery_tasks` | Ordered, executable task items with LLM instructions |
| `feature_task_issues` | Issues discovered during task implementation |

#### Feature conversation tables

| Table | Purpose |
|---|---|
| `feature_conversation_threads` | Intake conversation sessions |
| `feature_conversation_messages` | Messages with role (`user / assistant`) and proposal sets |

#### Sandbox execution tables

| Table | Purpose |
|---|---|
| `sandbox_runs` | Single implementation or verification sandbox run |
| `sandbox_milestone_sessions` | Orchestrated milestone-level execution session |
| `sandbox_milestone_session_tasks` | Individual task execution records within a milestone session |

#### Identity and access tables (M1 foundation + M12 full)

| Table | Purpose |
|---|---|
| `users` | User accounts: email, password hash, display name, avatar, timestamps (M1) |
| `sessions` | Session tokens with user ID and expiry (M1) |
| `project_members` | Join table linking users to projects with roles (`admin / reviewer / viewer`) (M12) |
| `api_keys` | Scoped API keys for MCP and external integrations, linked to user and optional project (M12) |
| `oauth_accounts` | OAuth provider links (provider, provider user ID, access token) linked to user (M12) |

#### Collaboration tables (M13)

| Table | Purpose |
|---|---|
| `comments` | Comments with polymorphic attachment (overview document, feature, specification, blueprint), author, timestamps |
| `notifications` | In-app notifications: type, recipient user, read/unread status, link to source entity |

#### Template and integration tables (M15–M16)

| Table | Purpose |
|---|---|
| `templates` | Reusable project templates: name, description, pre-filled questionnaire answers, decision card defaults, milestone structure |
| `webhooks` | Outbound webhook registrations: URL, HMAC secret, event type filter, project scope |
| `webhook_deliveries` | Delivery log: webhook ID, event, payload, HTTP status, retry count, timestamps |

#### Secrets and configuration tables

| Table | Purpose |
|---|---|
| `encrypted_secrets` | Encrypted secrets storage: key name, encrypted value, project scope, type (`github_pat / llm_api_key / oauth_token`), created/rotated timestamps. Write-only via API — never returned in responses. |

#### System tables

| Table | Purpose |
|---|---|
| `jobs` | Async work items with type, status, inputs, outputs, parent/dependency tracking |
| `llm_runs` | LLM execution history: template ID, model, parameters, token counts |
| `questions` | LLM-generated questions with category, priority, status, placement hints |
| `settings` | Scoped key-value settings (`system / user / org / project`). `system` stores deployment and execution defaults, `user` stores account preferences, `project` stores setup and policy configuration, and `org` is reserved for later multi-tenant use. |

#### Tool system tables

| Table | Purpose |
|---|---|
| `tool_catalog_versions` | Versioned snapshots of the full tool catalog |
| `tool_definitions` | Individual tool definitions within a catalog version (tool_id, version, action_level, schemas, metadata) |
| `tool_policy_snapshots` | Per-project versioned policy documents (tool group toggles, budget caps, sandbox command categories) |
| `tool_invocations` | Append-only invocation evidence log (tool_id, actor, inputs/outputs redacted, status, timestamps) |

#### Key enumerations

- **projectStateEnum**: `EMPTY, BOOTSTRAPPING, IMPORTING_A, IMPORTING_B, READY_PARTIAL, READY`
  - `EMPTY` — project record created, no setup started
  - `BOOTSTRAPPING` — setup in progress (scratch path: repo, LLM, sandbox being configured)
  - `IMPORTING_A` — import initiated: repo selected and auth verified, `RepoFingerprint` job queued
  - `IMPORTING_B` — fingerprint running; `DocsSummarise` / `SubsystemSummarise` jobs building memory chunks
  - `READY_PARTIAL` — memory built (import path) or questionnaire started (scratch path) but overview document not yet generated; user can proceed to questionnaire (scratch) or directly to overview document generation from memory chunks (import)
  - `READY` — overview document generated and approved; all subsequent phases are available
- **jobTypeEnum**: 60+ types covering all generation, review, refinement, execution, and utility jobs
- **jobStatusEnum**: `queued, running, succeeded, failed, cancelled`
- **featureStatusEnum**: `draft, approved, in_progress, completed, archived`
- **featureKindEnum**: `screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual`
- **priorityEnum**: `must_have, should_have, could_have, wont_have`
- **reviewItemSeverityEnum**: `BLOCKER, WARNING, SUGGESTION`
- **reviewItemStatusEnum**: `OPEN, DONE, ACCEPTED, IGNORED`
- **qualityGateStateEnum**: `NEEDS_REVIEW, CHANGES_REQUESTED, READY, APPROVED, REVIEWING`
- **autoAdvanceSessionStatusEnum**: `active, paused, completed, failed` — `POST .../stop` transitions an `active` session to `paused` (not a separate enum value)

### 3.4 API surface

The REST API is served by the Fastify backend under the `/api` prefix (except `/healthz`). The full endpoint list is in `README.md`; key areas are summarised here.

#### Projects
- `POST /projects` — create
- `GET /projects` — list
- `GET /projects/status-summary` — aggregated status
- `GET /projects/:id` — get
- `PATCH /projects/:id` — update
- `POST /projects/:id/generate-description` — trigger LLM description generation
- `POST /projects/:id/complete-one-pager-onboarding` — mark overview document phase complete
- `GET /projects/:id/next-actions` — Mission Control next-action queue
- `GET /projects/:id/phase-gates` — phase gate checklist

#### Overview document
- `GET/POST/PATCH /projects/:id/one-pager` — canonical overview document
- `GET /projects/:id/one-pager/versions` — version history
- `POST /projects/:id/one-pager/versions/:v/restore` — restore version
- `GET/PATCH /projects/:id/questionnaire-answers` — questionnaire persistence

#### User flows
- `GET/POST /projects/:id/user-flows` — list / create user flows
- `PATCH /user-flows/:id` — update a user flow
- `DELETE /user-flows/:id` — archive a user flow
- `POST /projects/:id/user-flows/generate` — generate initial or gap-fill user flows
- `POST /projects/:id/user-flows/deduplicate` — run deterministic dedupe across active flows
- `POST /projects/:id/user-flows/approve` — approve the current user-flow coverage set

#### Blueprint
- `POST /projects/:id/blueprints/generate-deck` — generate decision deck
- `GET/PATCH /projects/:id/decision-cards` — list / update cards
- `POST /projects/:id/blueprints/generate` — generate UX/tech project blueprints
- `POST /projects/:id/blueprints/save` — save a UX or tech blueprint directly and promote it to canonical
- `GET /projects/:id/blueprints/canonical` — current canonical project blueprints

#### Milestones
- `GET/POST /projects/:id/milestones` — list / create
- `POST /projects/:id/milestones/generate` — LLM-generate proposals
- `PATCH/POST /milestones/:id` — edit, approve, complete

#### Features
Full CRUD, revision history, all five specification tracks — product, UX, tech, user documentation, and architecture documentation (generate, review, refine, approve); workstream requirement flags (`ux_required`, `tech_required`, `user_docs_required`, `arch_docs_required`); dependencies (add, remove, list); feature issues; task planning (clarifications, generate, list tasks); implementation records; feature rollup. See `README.md` for complete listing.
- `GET /projects/:id/features/graph` — dependency graph as nodes + typed edges (read-only; derived from `feature_dependencies`)

#### Documentation specifications
- `GET/POST /features/:id/user-doc-revisions` — list / create user documentation revisions
- `POST /features/:id/user-doc-revisions/:rid/approve` — approve user documentation revision
- `GET/POST /features/:id/arch-doc-revisions` — list / create architecture documentation revisions
- `POST /features/:id/arch-doc-revisions/:rid/approve` — approve architecture documentation revision

#### Bug reports
- `GET/POST /features/:id/bugs` — list / create bug reports for a feature
- `GET/PATCH /bugs/:id` — get / update bug report (status, assignee)
- `POST /bugs/:id/fix-tasks` — generate fix tasks for a bug report
- `POST /bugs/:id/verify` — record verification evidence (sandbox run ID, test results, or reviewer sign-off)

#### Artifact workflow
- `GET /projects/:id/artifacts/:type/:aid/state` — workflow state
- `GET /projects/:id/artifacts/:type/:aid/review-items` — review items
- `POST /projects/:id/artifacts/:type/:aid/review/run` — trigger review job
- `PATCH /artifact-review-items/:id` — triage item
- `POST /projects/:id/artifacts/:type/:aid/approve` — approve

The `:type` parameter covers all reviewable artifact types: `one_pager`, `blueprint_ux`, `blueprint_tech`, `product_spec`, `ux_spec`, `tech_spec`, `user_doc`, `arch_doc`, `feature`. For feature workstream specs, `:aid` is the spec identity ID (e.g., `product_spec_id`), not the revision ID. The `feature` type is used for top-level feature case reviews (cohesion, cross-spec consistency).

#### Auto-advance / Mission Control
- `POST /projects/:id/auto-advance/start` — start (with `creativityMode`, `autoApproveWhenClear`, `skipReviewSteps`)
- `POST /projects/:id/auto-advance/stop`
- `POST /projects/:id/auto-advance/resume`
- `POST /projects/:id/auto-advance/reset` — clear runtime state and clean up execution leftovers
- `GET /projects/:id/auto-advance/status`
- `POST /projects/:id/auto-advance/step` — queue one next step manually

#### Sandbox execution
- `POST /projects/:id/sandbox/runs` — enqueue implementation/verification sandbox run
- `GET /sandbox/runs/:id` — sandbox run details with events and artifacts
- `POST /sandbox/runs/:id/cancel` — cancel and stop container
- `GET/POST /sandbox/containers` — container management
- `GET /sandbox/runs/:id/artifacts/:name` — download artifact

#### Tool system
- `GET /tool-catalog` — current tool catalog (filtered by auth scope)
- `GET /projects/:id/tool-policy` — current project tool policy
- `PUT /projects/:id/tool-policy` — update policy (creates new versioned snapshot)
- `GET /projects/:id/tool-invocations` — paginated invocation log with filters (tool_id, action_level, status, date range)

#### Secrets (write-only)
- `POST /projects/:id/secrets` — store encrypted credential (GitHub PAT, LLM API key, OAuth token); returns metadata only, never the secret value
- `PATCH /secrets/:id` — rotate or revoke a secret; hard-deletes on revocation
- `GET /projects/:id/secrets` — list secret metadata (type, created, last rotated, masked identifier) — value never returned

#### Infrastructure
- `GET /healthz` — health check
- `GET /api/system/readiness` — authenticated first-run deployment readiness status with remediation messages
- `GET /api/events` — SSE stream for live updates
- `GET /debug/*` — context packs (listing, detail, staleness), logbook, memory, scheduler status, SSE status

### 3.5 Job system

All LLM and execution work is dispatched as async **jobs** tracked in the `jobs` table.

**Lifecycle**: `queued -> running -> succeeded | failed | cancelled`

The **JobScheduler** (`apps/api/src/services/job-scheduler.ts`) runs a 5-second polling loop, picks up queued jobs, invokes the matching executor, and updates the job record with outputs or error information. An `onJobComplete` callback hook feeds the auto-advance service so sessions can progress automatically.

**Tool integration**: Each job executor receives a Tool Visibility Set and the active project tool policy at dispatch time. Job records include `tool_catalog_version` for reproducibility.

**Concurrency**: A global max-concurrent-workers limit prevents runaway parallelism.

#### Job types

| Area | Job Types |
|---|---|
| Overview document | `GenerateProjectOverview`, `RegenerateProjectOverview`, `GenerateOverviewImprovements`, `SuggestExampleAnswer` |
| Project description | `GenerateProjectDescription`, `SuggestProjectNames`, `AutoAnswerQuestionnaire` |
| User flows | `GenerateUseCases`, `DeduplicateUseCases` |
| Blueprint | `GenerateDecisionDeck`, `GenerateProjectBlueprint`, `ValidateDecisionConsistency`, `ReviewBlueprintUX`, `ReviewBlueprintTech` |
| Feature builder | `GenerateProductFromOnePager`, `GenerateUxFromProduct`, `GenerateTechFromProduct`, `AppendFeatureFromOnePager` |
| Feature review/refine | `ReviewProductInContext`, `ReviewUxInContext`, `ReviewTechInContext`, `RefineProductFromIssues`, `RefineUxFromIssues`, `RefineTechFromIssues`, `ReviewFeatureInContext`, `RefineFeatureFromIssues` |
| Milestones | `GenerateMilestones`, `GenerateMilestoneDesign` |
| Task planning | `GenerateTaskClarifications`, `AutoAnswerTaskClarifications`, `GenerateFeatureTaskList`, `RecommendNextFeature`, `ReviewFeatureCohesion` |
| Documentation | `GenerateUserDocsFromProduct`, `GenerateArchDocsFromTech`, `ReviewUserDocsInContext`, `ReviewArchDocsInContext`, `RefineUserDocsFromIssues`, `RefineArchDocsFromIssues` |
| Bug fix | `GenerateBugFixTasks`, `VerifyBugFix` |
| Quality gates | `AssessProjectIntent`, `ValidateArtifactQuality`, `GenerateAssumptionLedger`, `CheckCrossArtifactConsistency`, `StressTestTaskPlan` |
| Sandbox execution | `ImplementChange`, `TestAndVerify`, `ExecuteMilestoneSession` |
| Context | `BuildContextPack`, `RepoFingerprint` |
| Repository memory | `DocsSummarise`, `SubsystemSummarise` |
| Question worker | `RunQuestionWorker` |
| Feature conversations | `FeatureConversationTurn` |
| Feature intake | `CreateFeature`, `CreateFeatureRevision`, `ApplyFeatureProposals`, `DeduplicateFeatures` |
| Overview document (manual-draft paths) | `GenerateOnePager`, `RefineOnePagerSection` — used when a user authors or refines document sections manually rather than through the questionnaire-driven flow. The primary questionnaire path uses `GenerateProjectOverview` and `RegenerateProjectOverview`. Both sets are implemented. |

### 3.6 LLM integration

**Provider abstraction**: LLM calls go through a provider abstraction layer that supports multiple backends. Each provider implements a common interface (chat completion with streaming, model listing, and health check). Quayboard enables provider adapters at the deployment level, while each project selects one enabled provider and supplies its own credentials or endpoint override when required.

| Provider | Configuration | Use case |
|---|---|---|
| **Ollama** (local) | `LLM_PROVIDER=ollama`, `OLLAMA_HOST=http://localhost:11434` | Local development, air-gapped environments |
| **OpenAI-compatible** | `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` | Production with OpenAI, Azure OpenAI, or any OpenAI-compatible API |
| **Anthropic** | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | Production with Claude models |

The provider abstraction is defined in `apps/api/src/services/llm-provider.ts`. Adding a new provider requires implementing the interface and registering it — no changes to job executors or prompt templates.

**Prompt management**: LLM prompts are versioned markdown templates stored in `apps/api/src/prompts/`. Each job type has its own prompt directory. Template IDs are recorded in `llm_runs` for full traceability.

**Model selection**: Each project chooses different models per **activity type** (research, coding, reviewing) during Project Setup. Stored in project-scoped settings and applied at job dispatch time. A later global settings page may expose defaults or diagnostics, but the active model profile in MVP is project-scoped. The available model list is fetched from the provider selected for that project.

**Creativity mode**: A configurable policy (`off / scoped / balanced / high`) is applied to generation prompts via `apps/api/src/services/job-executors/creativity-policy.ts`. Set when starting an auto-advance session.

**Context packs**: Before a job runs, Quayboard assembles an immutable context snapshot from project memory, approved artifacts, and run history. The current architecture distinguishes two pack types: **planning packs** for non-coding jobs (one-pager, user flows, blueprints, repo summaries, feature metadata) and **coding packs** for implementation/verification jobs (approved specs, task detail, repo summaries, remediation context). Legacy pack profiles remain for backward compatibility, but the durable architecture is the `planning` / `coding` split. Packs record omission lists, source coverage, and staleness signals, and can be inspected from the Develop debug tooling.

**LLM run history**: Every LLM call is recorded in `llm_runs` with the model, provider, template ID, token counts, and full input/output, supporting cost tracking, debugging, and audit.

### 3.7 Real-time updates (SSE)

**Server**: `emitSSEEvent()` in `apps/api/src/services/sse.ts` broadcasts events to all connected clients.

**Client**: The frontend subscribes via the `useSSEEvent` hook from `apps/web/src/lib/sse.tsx`.

Events are emitted on job state changes, sandbox run updates, and auto-advance session transitions. This enables live job status updates without polling.

**ADR reference**: `docs/adr/007-sse-realtime-updates.md`

### 3.8 Sandbox execution

The Develop page enables execution of implementation and verification work inside **isolated containers** (Docker). The coding agent inside each container is **OpenCode** — a headless agentic code editor (`opencode-ai` npm package) that operates fully autonomously within the workspace.

**Feature-level execution**: All pending delivery tasks for a feature are bundled into a single `ImplementChange` sandbox run. The run is followed by a shared `TestAndVerify` verification run, which can reuse a warm-start worktree from the implementation run and apply bounded writable remediation when verification exposes fixable issues. Clean no-op implement runs are treated as terminal success. On successful verification, all bundled tasks are marked complete atomically. Each sandbox run captures: the context pack used, the repo SHA at start, all events (append-only), output artifacts (logs, diffs, test reports, screenshots), and a link to the resulting PR.

**Milestone sessions** (`sandbox_milestone_sessions`): An orchestrated run across multiple features in a milestone. The `ExecuteMilestoneSession` job type coordinates feature-level sandbox runs in order, respecting dependencies.

**Container management**: Managed containers are tracked and can be force-removed via the API. The Develop page lists active containers and allows disposal.

**Artifact storage**: Sandbox run artifacts are stored server-side and downloadable via the artifacts API.

**Key principles**:
- Deny-by-default network egress (allowlists for necessary external calls).
- No direct pushes — output is a PR, not a committed branch.
- All run context (inputs, policy snapshot, context pack) is captured for audit.
- Secrets (PATs, API keys) are injected via environment variables at runtime — never written to disk inside the container (see §3.16).
- Sandbox commands are restricted to configured command categories (`repo_ops`, `build`, `test`, `format`, `analysis`, `artifact_capture`) as defined in the project's tool policy (see §3.10). Arbitrary shell access is not available by default.

#### 3.8.1 Container initialisation

At run start, Quayboard performs the following steps in order before handing control to OpenCode:

1. Pull (or use the cached layer of) the sandbox image.
2. Start the container with resource limits and network policy applied.
3. Inject secrets as environment variables (`GITHUB_PAT`, `LLM_API_KEY`, etc.) — never as files.
4. Prepare the target repository in `/workspace`: a fresh clone for standard runs, or a cleaned warm-start worktree for verification retries when prior execution state is intentionally reused.
5. Write the context pack and feature task bundle to `/run/context.md` and `/run/tasks.md` respectively. The task bundle includes all pending tasks for the feature with their objectives, LLM instructions, and acceptance criteria.
6. Configure OpenCode with the project's LLM provider settings (Ollama endpoint, model name).
7. Set the working directory to `/workspace`.

OpenCode then runs autonomously inside `/workspace`, executing the feature task bundle. All outputs (diffs, test results, build artifacts, screenshots) are written to `/run/artifacts/` and captured by the artifact store before the container is removed.

#### 3.8.2 Sandbox image

Quayboard ships a single sandbox image built from `docker/agent-sandbox/Dockerfile`. The image is based on `python:3.12-slim-bookworm` and includes OpenCode plus all tooling required for the bootstrap agent script (`qb_agent.py`).

| Tool | Version | Purpose |
|---|---|---|
| **OpenCode** (`opencode-ai`) | latest (npm) | Headless agentic code editor — the sandbox runtime |
| **Python** | 3.12 | Bootstrap agent script (`qb_agent.py`), build tooling |
| **Node.js** | 20.x | JavaScript / TypeScript runtime |
| **npm** | bundled with Node | Package installation |
| **pnpm** | 9.x | Preferred monorepo package manager |
| **Rust** | stable (rustup) | Compilation toolchain for native dependencies |
| **wasm-bindgen-cli** | 0.2.100 | WebAssembly binding generation |
| **LiteLLM** | 1.75.0 | LLM provider proxy (Python, in agent venv) |
| **Playwright** | latest (Python) | E2E browser test runner; Chromium pre-installed |
| **Git** | system latest | VCS operations |
| **curl / jq** | system | HTTP calls and JSON processing |
| **build-essential** | system | C/C++ compilation for native addons |

The bootstrap entrypoint (`qb_entrypoint.sh`) initialises the container, configures OpenCode with the project's LLM provider settings, and hands control to OpenCode for autonomous execution of the feature task bundle.

#### 3.8.4 Allowed commands by category

The six sandbox command categories (toggled via tool policy) map to the following concrete permissions inside the container. All other commands are blocked by the container entrypoint and logged as policy violations.

| Category | Permitted operations |
|---|---|
| `repo_ops` | `git clone`, `git checkout`, `git add`, `git commit`, `git push` (feature branch only), `git diff`, `git log`, `git status`, `git stash`; `gh pr create`, `gh pr view`, `gh run view` |
| `build` | Any script defined in `package.json`, `Makefile`, `Taskfile`, or `pubspec.yaml`; `pnpm/npm/yarn/bun run <script>`; `tsc`; `vite build`; `turbo run build`; `gradle assemble`; `flutter build`; `uv build`; `pip install` |
| `test` | `pnpm/npm/bun test`; `vitest`; `jest`; `playwright test`; `flutter test`; `gradle test`; `pytest`; `uv run pytest`; test report capture to `/run/artifacts/` |
| `format` | `prettier --write`; `eslint --fix`; `black`; `ruff format`; `dart format`; writes back to tracked files in `/workspace` only |
| `analysis` | Read-only static analysis: `tsc --noEmit`; `eslint` (no fix); `ruff check`; `dart analyze`; `flutter analyze`; `mypy`; no file writes |
| `artifact_capture` | Copy files from `/workspace` to `/run/artifacts/`; `git diff HEAD` to produce patch files; generate test report JSON; `gh` PR link capture; no external uploads |

Commands outside these categories — including arbitrary shell access, `apt-get`, global package manager installs (`npm install -g`, `pip install --user`), and filesystem access outside `/workspace` and `/run` — are blocked.

### 3.9 MCP server

The `apps/mcp/` package exposes a **Model Context Protocol** (MCP) server that allows external LLM-native agents (Codex, Claude Code, etc.) to interact with Quayboard programmatically via structured tool calls.

The MCP server is a thin adapter: it wraps the Quayboard REST API and registers tool definitions consumable by any MCP-compatible agent.

**Available MCP tool groups**: Projects, Overview Documents, Blueprints, Milestones, Features, Artifacts, Jobs, Questions, Conversations, Settings, Debug.

**Setup**: The MCP server runs as a stdio transport (`node apps/mcp/dist/index.js`). It connects to the Quayboard API at `http://localhost:3001`. The process must not write non-protocol output to stdout.

**Tool governance**: MCP tool exposure is derived from the tool registry (see §3.10), filtered by the project's tool policy and API key scopes. MCP never exposes secret values, debug endpoints (unless admin scope), or policy mutation tools without explicit allow.

### 3.10 Tool system

Quayboard treats every capability that an LLM job or external agent can invoke as a **registered tool**. Tools are discoverable, governed by per-project policy, enforced server-side, and auditable via append-only invocation logs.

#### 3.10.1 Tool taxonomy

Six classes of tools:

| Class | Description | Examples |
|---|---|---|
| **Quayboard API tools** | Structured actions against Quayboard resources | Create feature, list review items, approve artifact |
| **Repository tools** | Git provider interactions | Open PR, fetch default branch SHA, list PR checks |
| **Sandbox execution tools** | Commands inside isolated containers | Run task plan, run tests, collect artifacts |
| **LLM provider tools** | Inference calls through Quayboard executors | Generation, review, refinement (never free-form) |
| **Asset provider tools** | External asset generation via adapters | Image generation, 3D mesh creation |
| **Integration tools** | Outbound actions | Webhooks, notifications, export generation |

#### 3.10.2 Action levels

Every tool is assigned an immutable action level that determines its governance tier:

| Level | Meaning |
|---|---|
| `READ` | Reads state; no mutation, no side effects |
| `WRITE` | Mutates Quayboard state; no external side effects |
| `ELEVATED_WRITE` | Mutates external systems (PR creation, credential changes) |
| `EXECUTE` | Runs code in a sandbox environment |
| `PROVIDER_CALL` | Calls an external provider API (LLM, asset generation) |
| `ADMIN` | Security-sensitive changes (credentials, RBAC, policy) |

Action level is immutable for a tool definition version; changes require a new tool version.

#### 3.10.3 Tool registry

A versioned catalog of all tool definitions:

- `tool_id`: stable identifier (e.g., `qb.features.create`, `sandbox.run_command`)
- `version`: semantic version
- `name`, `description`: display metadata
- `action_level`: governance tier
- `input_schema` / `output_schema`: Zod/JSON schema (strict)
- `constraints`: hard limits (max payload size, timeouts, allowed enums)
- `cost_model`: optional (token estimates, provider pricing, rate limits)
- `security`: flags (`requires_approval`, `requires_budget`, `requires_egress`)
- `tags`: discoverability tags (`planning`, `review`, `execution`, `assets`, `repo`, `debug`)

The registry is stored in `tool_catalog_versions` + `tool_definitions` tables. Every job run records `tool_catalog_version` for reproducibility. Breaking changes require a new major version.

#### 3.10.4 Tool execution model

Three execution modes, determined by action level:

1. **Synchronous READ** — Inline within LLM job runs for grounding. Used to fetch phase gates, list artifacts, read canonical revisions. Reduces hallucination by letting the model inspect real state before generating.

2. **Proposed mutation via `tool_intent`** — For WRITE actions, the model emits structured `tool_intent` proposals (tool_id + inputs + rationale). Quayboard validates each proposal against policy and schemas, then executes. This prevents silent mutations and makes all tool usage reviewable.

3. **Jobified execution** — All EXECUTE, PROVIDER_CALL, and ADMIN actions run as Quayboard jobs. This provides retries, cancellation, progress tracking, budget enforcement, and consistent evidence capture.

Core rule: the model may select tools and provide inputs, but Quayboard is always the executor and enforcement point.

#### 3.10.5 Tool discovery (Tool Visibility Sets)

Each job type receives a deterministic **Tool Visibility Set (TVS)** controlling which tools appear in the LLM's prompt context:

| TVS Profile | Tools included | Excluded |
|---|---|---|
| `planning_small` | READ tools: artifacts, phase gates, features, milestones, memory | No EXECUTE, no repo writes, no provider calls |
| `planning_rich` | Adds: dependency graph, decisions, assumptions ledger | Same exclusions |
| `review` | Adds: WRITE tools for creating review items | No approvals, no execution |
| `execution_prep` | Adds: read approved specs, tasks, repo fingerprints | No execution yet |
| `execution` | Adds: EXECUTE tools, repo ELEVATED_WRITE (PR output) | Gated by sandbox policy |
| `assets` | Adds: asset PROVIDER_CALL tools | Gated by provider policy |

Each LLM executor injects a filtered **Tool Catalog** block into its prompt context, generated from the registry, active TVS, and project policy. The catalog includes tool descriptions, compact schemas, constraints, examples, and a selection rubric ("prefer READ before assumptions", "never attempt actions not in the catalog").

Job templates can include **tool hints** — short guidance notes maintained alongside prompt templates (e.g., "use `qb.milestones.list` to check milestone state").

#### 3.10.6 Project tool policy

Each project has a versioned `tool_policy_snapshot` controlling tool access:

- **Tool group toggles**: `planning`, `review`, `repo`, `sandbox`, `assets`, `integrations` — each on/off
- **Budget caps**: LLM token/cost cap per period, asset generation count/cost cap per period, auto-advance wall-clock limit
- **Sandbox command categories**: `repo_ops`, `build`, `test`, `format`, `analysis`, `artifact_capture` — each on/off (derived automatically from sandbox defaults where possible)
- **Provider allowlists**: which LLM providers/models and asset providers are permitted

**Enforcement precedence** when a tool call is requested:
1. Tool group check → blocked if group disabled
2. Budget check → blocked if budget exceeded
3. Sandbox/egress constraints (if EXECUTE/PROVIDER_CALL) → blocked if non-compliant
4. Schema validation → blocked if invalid inputs

All blocks produce structured errors and audit entries. The policy UI lives in Project Setup as an optional collapsible section with sensible defaults pre-applied.

> **Future extension**: Individual tool deny lists and per-action-level approval gates will be added in a later milestone for teams needing fine-grained control.

#### 3.10.7 Tool invocation logging

Every tool invocation produces an append-only record in the `tool_invocations` table:

- `id`, `project_id`, `job_id` (nullable), `sandbox_run_id` (nullable)
- `source`: UI, MCP, auto-advance, executor
- `tool_id`, `tool_version`, `policy_snapshot_id`
- `actor_user_id` or `api_key_id`
- `requested_at`, `completed_at`
- `inputs_redacted`, `outputs_redacted`
- `status`: succeeded, failed, blocked_by_policy
- `error`: structured error if failed
- `external_refs`: provider task IDs, PR IDs, etc.

Inputs and outputs are redacted (regex-based secret patterns, structural JSON path masking) before persistence and before rendering to non-admin roles.

#### 3.10.8 Execution tokens

For sensitive sequences (sandbox runs, PR creation, provider calls), Quayboard mints short-lived **execution tokens** scoped to: a project, a specific tool set, a maximum invocation count, a wall-clock expiry, and optionally a specific job/run. This prevents replay and lateral actions beyond the intended run.

#### 3.10.9 Misuse prevention

- If the LLM proposes tool calls outside the catalog, the system rejects them and records a "hallucinated tool" metric.
- If tool inputs fail schema validation, the job is marked "needs review" with a diagnostic hint.
- If a job repeatedly proposes blocked tools, auto-advance pauses with an explicit "policy mismatch" banner.
- If required tools are missing or policy blocks actions, the LLM is instructed to emit a structured `needs_human` entry describing what is missing and the minimal human decision required.

### 3.11 Phase gate system

The phase gate system provides a structured checklist of what must be true before a project can progress from one phase to the next.

#### Phase gate conditions (per phase)

| Phase | Gate conditions (all must pass) |
|---|---|
| **Project Setup** | Repo connected and access verified; LLM provider configured and reachable; sandbox container startup verified |
| **Overview Document** | Project Setup gate passed; questionnaire complete (scratch) or memory chunks built (import); overview document generated; all BLOCKER review items resolved; overview document approved |
| **Product Spec** | Overview Document gate passed; Product Spec generated; Product Spec approved |
| **User Flows** | Product Spec gate passed; at least one active user flow exists; coverage warnings are resolved or explicitly accepted; user-flow set approved |
| **Blueprint** | User Flows gate passed; decision deck generated and all cards have a user selection; UX blueprint generated; tech blueprint generated; all BLOCKER review items on both blueprints resolved; both blueprints approved |
| **Milestones** | Blueprint gate passed; at least one milestone exists in `approved` state |
| **Features** | Milestones gate passed; at least one feature exists with an approved product specification |
| **Task Planning** | At least one feature has an approved tech specification and a generated, non-empty delivery task list |
| **Sandbox Execution** | Task Planning gate passed; at least one sandbox run in `succeeded` state with a linked PR |

Gates are re-evaluated in real time via SSE whenever relevant state changes. A failed gate does not prevent manual navigation to other pages — it blocks auto-advance progression and surfaces a visual warning on Mission Control.

- **API**: `GET /projects/:id/phase-gates` returns a `PhaseGatesResponse` (array of phases, each with gate items and status)
- **Service**: `apps/api/src/services/phase-gate-service.ts` — pure function `buildPhaseGates(summary)`
- **Shared types**: `packages/shared/src/schemas/phase-gates.ts` — `PhaseGate`, `PhaseGateItem`, `PhaseGateStatus`
- **Frontend hook**: `apps/web/src/hooks/usePhaseGates.ts` — SSE-reactive, used by Mission Control and Milestones
- **UI**: `apps/web/src/components/workflow/PhaseGateChecklist.tsx`

### 3.12 Auto-advance / Mission Control

Mission Control is the orchestration surface and default landing page of Quayboard (`/projects/:id`). It provides:

1. **Stage map** (`MissionControlTubeMap`) — tube-map-style visualiser showing all phases and the current position.
2. **Next-actions panel** (`NextActionsPanel`) — ordered list of the next automatable steps.
3. **Auto-advance controls** — start, stop, resume, reset, and step-through of the automated pipeline.
4. **Activity timeline** — log of all completed events in the session.
5. **Stats strip** — progress statistics (features completed, tasks done, etc.).
6. **Implementation staleness** — features where `head_tech_revision_id != implemented_tech_revision_id` are flagged as "Implementation out of date" and surfaced as next-action items. This ensures specification edits after implementation are never silently ignored.

**Auto-advance session**: Stored in the database with status `active / paused / completed / failed`. The auto-advance service listens to job completions and enqueues the next step when the current one succeeds and quality gates are clear.

**Stage order** (as driven by auto-advance):
1. Project setup readiness (repo connected, LLM verified, sandbox configured)
2. Overview document prep and review
3. Overview document quality gates
4. User-flow generation, dedupe, coverage checks, and approval
5. Project blueprint generation and review
6. Milestone and feature seeding
7. Feature specification review/refinement loops
8. Documentation generation and review (user docs, architecture docs)
9. Feature delivery loop (sandbox runs: all pending tasks for a feature are bundled into a single `ImplementChange` run, then `TestAndVerify`)
10. Bug fix and verification loop (if bugs are reported)
11. PR merge, completion, and finalisation

**Control surface**: Starting auto-advance can enable `autoApproveWhenClear`, `skipReviewSteps`, and `creativityMode`; active sessions can also be stopped, resumed, stepped one action at a time, or reset to clear stuck execution state.

### 3.13 Quality gates

Five quality gate job types can pause the auto-advance pipeline when issues are found:

| Gate | Job Type | When it runs |
|---|---|---|
| **Intent assessment** | `AssessProjectIntent` | After questionnaire, before overview document generation |
| **Artifact quality** | `ValidateArtifactQuality` | After overview document and project blueprint generation |
| **Assumption ledger** | `GenerateAssumptionLedger` | To detect unresolved assumptions in plans |
| **Cross-artifact consistency** | `CheckCrossArtifactConsistency` | To verify overview document and project blueprint alignment |
| **Task stress test** | `StressTestTaskPlan` | Before task execution begins |

Each gate produces structured output (shared schemas in `packages/shared/src/schemas/automation-quality.ts`) stored in the `jobs.outputs` JSON column of the triggering job record. The auto-advance session is set to `paused` until a human reviews and resolves the findings.

### 3.14 Error handling and failure modes

The system must handle failures gracefully at every layer. The following policies apply:

#### LLM job failures
- Jobs that fail are marked `failed` with an error message stored in the job record.
- **Retry policy**: Configurable per job type. Default: 2 retries with exponential backoff (5s, 15s). After max retries, the job transitions to `failed` permanently.
- **Auto-advance behaviour**: When a job fails during an auto-advance session, the session transitions to `paused` with the failed job ID recorded. The user must resolve the failure (retry manually, skip, or cancel) before resuming.
- **User notification**: Job failures emit an SSE event (`job:failed`) so the frontend can display an error state immediately. In M13+, this also triggers a notification.

#### LLM provider unavailability
- If the configured LLM provider is unreachable, job execution fails immediately (no silent hang). The error message must include the provider URL and connection error.
- The health check (`GET /healthz`) should report LLM provider connectivity status as a degraded (not failed) state — Quayboard remains usable for non-LLM operations.

#### Sandbox container failures
- If a container crashes mid-run, the sandbox run is marked `failed` with the last captured event and any partial artifacts preserved.
- Orphaned containers (running but not associated with an active run) are cleaned up by a periodic sweep (configurable interval, default 15 minutes).
- Container startup failures (image pull failure, resource limits) are reported immediately as run failures — no silent retry loop.

#### SSE reconnection
- The frontend SSE client must implement automatic reconnection with exponential backoff (1s, 2s, 4s, capped at 30s).
- On reconnection, the client must re-fetch current state (active jobs, auto-advance status) to avoid stale UI.
- The server should send periodic heartbeat events (every 30s) so clients can detect dead connections.

#### Concurrency guards
- **One auto-advance session per project**: Starting a new auto-advance session while one is already `active` must return 409 Conflict.
- **One active job per artifact**: Triggering a generation or review job for an artifact that already has a `running` job of the same type must return 409 Conflict.
- **Approval race condition**: Approving an artifact while a review job is still running must return 409 Conflict. The user must wait for the review to complete or cancel the review job first.

#### Database and migration failures
- Migration failures must halt server startup — the API must not serve requests against an outdated schema.
- Database connection loss during operation should cause affected requests to return 503 Service Unavailable, not 500 Internal Server Error.

### 3.15 Deployment and infrastructure

#### Production deployment
- The API and web frontend are deployed as separate processes (not co-hosted). The web frontend is a static build served by a CDN or static file server.
- The API requires a PostgreSQL 15+ instance, a configured LLM provider, and (for sandbox execution) access to a Docker daemon.
- Environment configuration is via environment variables (documented in `.env.example`). No configuration files are checked into the repository.

**First-run readiness boundary**: Deployment prerequisites are checked at the instance level before project onboarding. Repo access, project PATs, project LLM credentials, and project policy remain inside Project Setup and are never promoted to user-level or system-level secrets in the MVP.

#### Artifact storage
- Sandbox run artifacts (logs, diffs, test reports) are stored on the local filesystem in a configurable directory (`ARTIFACT_STORAGE_PATH`). For production, this should be a persistent volume or object storage mount.
- Artifacts are served via the API (`GET /sandbox/runs/:id/artifacts/:name`) — the frontend never accesses storage directly.

#### Sandbox container management
- In development, sandbox containers run against the local Docker daemon.
- In production, the Docker host is configurable (`DOCKER_HOST`). Options include a remote Docker daemon, Docker-in-Docker, or a Kubernetes-based container runner (future).
- Sandbox containers have configurable resource limits (CPU, memory, timeout) via settings.
- Network egress from sandbox containers is deny-by-default. Allowlists are configured per project.

#### Database operations
- Migrations are run manually via `pnpm db:migrate` before deploying a new API version. Rolling back a migration requires writing a reverse migration.
- The database should be backed up before running migrations in production.

### 3.16 Secrets management

All sensitive credentials (GitHub PATs, LLM API keys, OAuth tokens) are managed through a dedicated secrets subsystem.

**Storage**: Secrets are stored encrypted at rest in the `encrypted_secrets` table using application-level encryption with a server-side key (`SECRETS_ENCRYPTION_KEY` environment variable). The encryption key itself is never stored in the database.

**API contract — write-only**: Secrets are written via API (`POST /projects/:id/secrets`, `PATCH /secrets/:id`) but never returned in API responses. The API returns only metadata (type, created timestamp, last rotated timestamp, masked identifier). The MCP server follows the same write-only contract — it never receives raw secret values.

**Scoped access**: Each secret is scoped to a project. A project's GitHub PAT is only available to sandbox runs for that project. Cross-project secret access is prohibited at the service layer.

**Runtime injection**: Secrets are injected into sandbox containers via environment variables at launch time. They are never written to disk inside the container filesystem, and are not included in container images.

**Rotation and revocation**: Users can update or revoke PATs and API keys at any time via the Project Setup page. When a secret is revoked:
- Active sandbox runs using the revoked secret fail gracefully with a clear error ("secret revoked during run").
- The revoked secret is hard-deleted from the `encrypted_secrets` table (not soft-deleted).
- A notification is sent to the project owner confirming revocation.

### 3.17 Bug report lifecycle

Bug reports provide a structured loop for tracking defects discovered during sandbox execution or PR review and verifying their fixes.

**Lifecycle**: `open → in_progress → fixed → verified → closed` (or `wont_fix` at any stage).

**Links**: Each bug report connects to:
- Feature ID and implemented tech revision (which specification version was active)
- Sandbox run ID (which run produced the buggy output)
- PR link (which PR contains the defect)
- Environment snapshot: model, provider, creativity mode, policy settings at time of the run

**Fix path**: A bug can be resolved by:
1. Spawning a new fix task set (`GenerateBugFixTasks` job) — targeted tasks scoped to the specific defect
2. Creating a new feature revision — if the bug indicates a specification gap

**Verification**: Closing a bug as `verified` requires at least one form of evidence:
- A verification sandbox run ID (a new `TestAndVerify` run that passes)
- Passing test results attached to the bug report
- Explicit reviewer sign-off (reviewer user ID and timestamp)

---

## 4. Delivery Roadmap

The following milestones describe an ordered delivery plan. Each milestone is self-contained and produces a demonstrable result. Later milestones build on earlier ones.

---

### M0 — Repository and Toolchain Foundations

**Goal**: Establish the monorepo, toolchain, CI baseline, and local development environment. No product functionality yet.

**Deliverables**:
- Monorepo scaffold using pnpm workspaces: `apps/api`, `apps/web`, `apps/mcp`, `packages/shared`
- TypeScript 5.7 configured across all packages
- Tailwind CSS + shadcn/ui design tokens configured (Harbor Night dark theme, CSS variables)
- Docker Compose file for local Postgres
- `.env.example` with all required environment variables documented
- `pnpm dev` starts API (port 3001) and web (port 3000) in parallel
- `pnpm build` produces clean output for all packages
- `pnpm typecheck` passes with zero errors
- Vitest configured for unit tests (SQLite) and integration tests (Postgres)
- Playwright configured for E2E tests
- CI pipeline runs typecheck, unit tests, and build on every PR
- `docs/user/` and `docs/architecture/` directory scaffolding with initial README files

**Acceptance criteria**:
- `pnpm install && pnpm build` succeeds on a clean checkout with no errors
- `docker compose up -d && pnpm db:migrate` runs without errors on a fresh Postgres instance
- `pnpm dev` starts both servers; `GET /healthz` returns 200
- `pnpm typecheck && pnpm test && pnpm build` all pass in CI
- Internal architecture documentation exists for the monorepo structure, toolchain choices, and CI pipeline configuration

---

### M1 — Database, API Skeleton, and Auth Foundation

**Goal**: Stand up the API with core tables, authentication scaffolding, health and SSE endpoints. No LLM calls yet. Each subsequent milestone adds its own tables via incremental migrations.

**Deliverables**:
- Drizzle schema in `apps/api/src/db/schema.ts` covering core tables: `projects`, `project_counters`, `repos`, `users`, `sessions`, `jobs`, `llm_runs`, `settings`, `encrypted_secrets`
- Initial SQL migration and journal entry in `apps/api/drizzle/`
- Authentication foundation:
  - `users` table (email, password hash, display name, avatar, timestamps)
  - `sessions` table (session token, user ID, expiry)
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` routes
  - Session middleware on all `/api/*` routes — every request has a known user from M1 onwards
  - Password hashing (bcrypt/argon2)
  - Login / register page in the frontend (minimal — styled with DS primitives)
- Fastify API server with:
  - `GET /healthz` health check
  - `GET /api/events` SSE endpoint (connection management, heartbeat, scoped to authenticated user)
  - CORS configured for `http://localhost:3000`
  - Zod-validated request/response schemas for all routes (handlers may return 501 stubs)
- `packages/shared` Zod schemas for: projects, users, sessions, settings, SSE events
- All route files scaffolded (returning stub responses where not yet built)
- Secrets management:
  - `encrypted_secrets` table (type, encrypted value, project scope, created/rotated timestamps)
  - Write-only secrets API (`POST /projects/:id/secrets`, `PATCH /secrets/:id`) — secrets are never returned in responses
  - Secrets middleware for injecting credentials into sandbox container environment at runtime
- Integration tests covering database connection, migration idempotency, health endpoint, and auth flow

> **Note on incremental schema**: Section 3.3 lists the complete target schema. M1 creates only the foundation tables. Each subsequent milestone adds its own tables via new migrations (e.g., M2 adds `one_pagers`, `questionnaire_answers`; M4 adds `milestones`, `feature_cases`). This avoids premature schema design for features that haven't been built yet.

**Acceptance criteria**:
- `pnpm db:migrate` runs all migrations on a fresh Postgres instance without errors
- `GET /healthz` returns `{ status: "ok" }` with 200
- `GET /api/events` returns a valid SSE stream (`text/event-stream` content type) for authenticated clients; returns 401 for unauthenticated clients
- User can register, log in, and access protected routes with a valid session
- Unauthenticated requests to `/api/*` routes (except `/healthz` and `/auth/*`) return 401
- All shared schema imports resolve without TypeScript errors
- Secrets can be written via API but are never returned in GET responses (only metadata: type, created, last rotated)
- Integration test suite passes, including auth flow tests
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M2 — Project Creation, Setup, Overview Document, Product Spec, and User Flows

**Goal**: A user can clear first-run instance readiness, create a project, complete project setup (repo, LLM, sandbox configuration), complete the 14-question questionnaire, trigger LLM-assisted generation of a project description and overview document, review/approve the result, generate and approve a Product Spec from that overview, and then generate and approve a user-flow set that becomes the planning contract for later stages. Mission Control becomes the project landing page. A guided onboarding flow introduces the full pipeline, with the execution portion completed later when sandbox runs exist.

**Deliverables**:

**Schema additions** (new migrations):
- `one_pagers`, `product_specs`, `questionnaire_answers`, `questions`, `use_cases`
- project user-flow approval metadata (`user_flows_approved_at`, `user_flows_approval_snapshot`)

**Backend**:
- Instance readiness route:
  - `GET /api/system/readiness` — deployment prerequisite status (database, encryption key, Docker, artifact storage, enabled provider adapters) with remediation messages
- Project CRUD routes (`POST/GET /projects`, `GET/PATCH /projects/:id`) — all auth-protected, projects scoped to the creating user
- Project Setup routes:
  - `POST /projects/:id/secrets` — store repo PAT or LLM API key (write-only, uses `encrypted_secrets` from M1)
  - `GET /projects/:id/setup-status` — readiness checklist status (repo connected, LLM verified, sandbox configured)
  - `POST /projects/:id/verify-llm` — test LLM provider connectivity
  - `POST /projects/:id/verify-sandbox` — test sandbox container startup
- Questionnaire answer persistence (`GET/PATCH /projects/:id/questionnaire-answers`)
- Overview document routes (canonical, versions, restore)
- Product Spec routes (canonical, versions, restore, approve)
- User-flow routes (list, create, update, archive, generate, deduplicate, approve)
- Job system: scheduler polling loop, job CRUD routes, terminal state handling
- LLM executors: `GenerateProjectDescription`, `GenerateProjectOverview`, `RegenerateProjectOverview`, `GenerateOverviewImprovements`, `GenerateProductSpec`, `RegenerateProductSpec`, `GenerateProductSpecImprovements`, `SuggestExampleAnswer`, `SuggestProjectNames`, `AutoAnswerQuestionnaire`, `GenerateUseCases`, `DeduplicateUseCases`, `GenerateOnePager`, `RefineOnePagerSection`
- LLM provider integration via provider abstraction (see §3.6)
- SSE events emitted on job state changes

**Frontend**:
- `HomePage` — project list, empty state, error state, filter bar, status badges
- `InstanceReadinessPage` (`/setup/instance`) — first-run deployment checks with remediation guidance for missing prerequisites
- `NewProjectPage` — create from scratch / import chooser
- `ProjectSetupPage` (`/projects/:id/setup`) — repo connection (PAT/OAuth), project-scoped LLM provider and model selection, connectivity verification, sandbox defaults (timeouts, CPU/mem, egress policy), and evidence/docs policy with inline saved/verified status
- `MissionControlPage` (`/projects/:id`) — project landing page absorbing the old `ProjectDetailPage` phase summary. Shows stage map, next actions, and activity timeline (auto-advance controls added in M7)
- `ProjectContextHeader` — persistent sticky header on all project-scoped pages (project state, repo, model profile, sandbox policy, setup readiness)
- `OnePagerQuestionsPage` — questionnaire phase with autosave and LLM blank-answer generation
- `OnePagerOverviewPage` — overview document phase, history, restore, and approval
- `ProductSpecPage` — Product Spec phase, history, restore, editing, and approval
- `UserFlowsPage` (`/projects/:id/user-flows`) — generation, manual editing, coverage summary, dedupe, and approval
- Guided onboarding flow — step-by-step walkthrough: register or log in → clear instance readiness → create project → connect repo → verify LLM → verify sandbox → complete questionnaire and overview document
- DS primitives: `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Spinner`, `Skeleton`, `Alert`, `Toast`
- DS composites: `CenteredState`, `PageIntro`, `WorkspaceTopBar`
- DS layout: `Layout`, `PrimaryBar`, `AppFrame`, `ProjectContextHeader`
- `useJobPoller` hook for live job status
- `useSSEEvent` hook for real-time updates
- `api.ts` API client module — no inline `fetch()` in page components

**Acceptance criteria**:
- Authenticated user can load the instance readiness screen and see pass/fail status plus remediation guidance for deployment prerequisites
- User can create a project, connect a repo, verify LLM connectivity, and verify sandbox startup from the Project Setup page
- Setup readiness checklist shows green/red status for each item; all items green before proceeding
- Mission Control (`/projects/:id`) serves as the project landing page and shows phase status summary
- Project Context Header appears on all project-scoped pages with accurate state
- User can complete all 14 questionnaire questions and generate an overview document without errors
- LLM job is dispatched, tracked in `jobs` table, and result updates the overview document
- Overview document versions are stored and restorable
- Product Spec can be generated from the approved overview document, edited manually, versioned, restored, and approved
- User flows can be generated from the approved Product Spec, edited manually, deduplicated, and approved only when coverage requirements are satisfied
- Blueprint generation remains locked until user flows are approved
- SSE events cause the frontend to update job status in real time without polling
- A guided onboarding scaffold exists introducing the workspace: account creation, instance readiness, project creation, repository connection, LLM verification, sandbox verification, and questionnaire completion. The full pipeline demo (sandbox run → PR → evidence bundle) is scoped to M8 once sandbox execution is available.
- Repo PATs and LLM API keys are project-scoped only; no user-level or system-level secret defaults are introduced
- All new routes and executors have unit or integration tests
- No raw `<button>/<input>` in page files; DS primitives used throughout
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M3 — Blueprint Builder

**Goal**: After approving user flows, a user can generate a decision deck, select options, generate both UX and tech project blueprints from the completed deck, review LLM findings, and approve both blueprints.

**Deliverables**:

**Schema additions** (new migrations):
- `decision_cards`, `project_blueprints`, `artifact_review_runs`, `artifact_review_items`, `artifact_approvals`

**Backend**:
- Blueprint routes (decision deck, cards CRUD, generate UX/tech, save direct, canonical)
- LLM executors: `GenerateDecisionDeck`, `GenerateProjectBlueprint`, `ValidateDecisionConsistency`, `ReviewBlueprintUX`, `ReviewBlueprintTech`
- Artifact workflow routes: state, review items, triage, approval, transition check
- `artifact_review_runs`, `artifact_review_items`, `artifact_approvals` table operations

**Frontend**:
- `BlueprintBuilderPage` with two sub-views:
  - `DecisionCardDeck` — card selection UI with recommendations and alternatives plus the deck-bottom blueprint generation CTA
  - `BlueprintDocumentView` — markdown view with review panel
- `ReviewPanel` component — review item triage (DONE / ACCEPTED / IGNORED)
- Header AI action for decision-deck generation
- `NextActionBar` component — deck-bottom generation CTA, review actions, and top-of-view blueprint approval CTA
- `TransitionConfirmDialog` — approval confirmation modal

**Acceptance criteria**:
- Decision deck generates only after user flows are approved; cards are selectable and selections persist
- UX and tech blueprint views stay locked until every decision card has a selected or custom choice
- Both UX and tech project blueprints generate from the completed decision deck flow
- UX and tech blueprints can also be saved directly via API/MCP for manual authoring paths
- Review jobs surface BLOCKER/WARNING/SUGGESTION items in the review panel
- Approval button is surfaced at the top of each blueprint view and remains disabled while any BLOCKER item remains OPEN
- Approval writes an `artifact_approvals` record and advances the project phase
- Tests cover decision card update, blueprint generation trigger, review item triage, and approval flow
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M4 — Milestones and Feature Builder

**Goal**: After project blueprints are approved, a user can create milestones (manually or LLM-generated from approved user flows plus blueprint context), approve them, and begin creating features in the feature catalogue.

**Deliverables**:

**Schema additions** (new migrations):
- `milestones`, `milestone_use_cases`, `milestone_design_docs`, `feature_cases`, `feature_revisions`, `feature_edges`, `feature_dependencies`

**Backend**:
- Milestone routes (CRUD, approve, complete, LLM generate)
- `GenerateMilestones` LLM executor (proposes milestone structure from approved user flows and project blueprints)
- `GenerateMilestoneDesign` LLM executor (generates a design document for an approved milestone)
- Milestone design doc routes (`GET/POST /milestones/:id/design-docs`, `POST /milestones/:id/design-docs/:rid/approve`)
- Feature CRUD routes (`POST/GET /projects/:id/features`, `GET/PATCH/DELETE /features/:id`)
- Feature revision routes (create, list)
- Feature dependency routes (add, remove, list)
- `AppendFeatureFromOnePager` LLM executor (seed features from overview document)
- Feature rollup route (`GET /projects/:id/features/rollup`)

**Frontend**:
- `MilestonesPage` — milestone list, lifecycle controls (create, edit, approve, complete), milestone design doc view (markdown preview, generate/approve design doc)
- `FeatureBuilderPage` — catalogue table view with status/kind/priority filters
- Feature intake drawer (inline feature creation)
- `FeatureDependencyGraph` component — DAG visualisation of feature nodes and typed edges, rendered from `GET /projects/:id/features/graph`; embedded in the Feature Builder page
- `PhaseGateChecklist` component
- `StateMachineVisualizer` component
- `usePhaseGates` hook (SSE-reactive)

**Acceptance criteria**:
- Milestones can be created manually and via LLM generation
- Milestone generation reports journey coverage against approved user flows and stores milestone-to-user-flow links
- Milestone lifecycle transitions (`draft -> approved -> completed`) enforce correct ordering
- A design document can be generated for any approved milestone and approved independently
- Features cannot be created without selecting an approved milestone
- Features can be seeded from the overview document via LLM
- Feature dependencies can be wired and visualised; `GET /projects/:id/features/graph` returns correct nodes and typed edges matching the wired `feature_dependencies`
- Phase gate checklist reflects milestone and feature state in real time via SSE
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M5 — Feature Workstream Specifications (Product / UX / Tech)

**Goal**: Each feature has five independent workstream tracks. Users or LLM can author feature specifications for each track; specifications are versioned and independently approvable.

**Deliverables**:

**Schema additions** (new migrations):
- `product_specs`, `product_revisions`, `ux_specs`, `ux_revisions`, `tech_specs`, `tech_revisions`, `user_doc_specs`, `user_doc_revisions`, `arch_doc_specs`, `arch_doc_revisions`

**Backend**:
- Product specification routes (revisions, approve, LLM generate)
- UX specification routes (revisions, approve, LLM generate)
- Tech specification routes (revisions, approve, LLM generate)
- User documentation routes (revisions, approve, LLM generate via `GenerateUserDocsFromProduct`)
- Architecture documentation routes (revisions, approve, LLM generate via `GenerateArchDocsFromTech`)
- Feature tracks route (`GET /features/:id/tracks`) — includes user docs and arch docs track status
- LLM executors: `GenerateProductFromOnePager`, `GenerateUxFromProduct`, `GenerateTechFromProduct`, `GenerateUserDocsFromProduct`, `GenerateArchDocsFromTech`
- Workstream requirement flags (`ux_required`, `tech_required`, `user_docs_required`, `arch_docs_required`) on product revisions

**Frontend**:
- `FeatureEditorPage` with six tabs (five specification types plus a Tasks workflow tab; M6 adds a seventh Bugs tab):
  - Product specification tab — markdown editor, revision history, approve button
  - UX specification tab — markdown editor, revision history, approve button
  - Tech specification tab — markdown editor, revision history, approve button
  - User documentation tab — markdown editor, revision history, approve button
  - Architecture documentation tab — markdown editor, revision history, approve button
  - Tasks tab (stub for M6)
- Each documentation tab follows the standardised review layout (§2.7): left editor, right ReviewPanel, bottom NextActionBar
- Implementation status badge per workstream track ("Implemented: yes/no", which revision)
- `MarkdownDocument` component (editor/preview/export with copy-to-clipboard)

**Acceptance criteria**:
- All five workstream specifications can be authored manually or generated by LLM
- Each specification has an independent, navigable revision history
- Each specification can be approved independently of the others
- `ux_required`, `tech_required`, `user_docs_required`, and `arch_docs_required` flags hide/show the respective workstream tabs correctly
- `GET /features/:id/tracks` returns the current approval state of all five workstreams
- If a specification is edited after implementation, the Feature Editor shows "Implementation out of date" badge and a next-action to re-implement the feature
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M6 — Feature Review, Approval, and Task Planning

**Goal**: LLM review jobs surface issues in feature specifications; users triage them; approved specifications flow into task planning; tasks are generated and ordered for sandbox execution. Bug reports can be filed against sandbox run outputs and tracked through a structured fix-and-verify lifecycle.

**Deliverables**:

**Schema additions** (new migrations):
- `feature_issues`, `artifact_issues`, `feature_task_planning_sessions`, `feature_task_clarifications`, `feature_task_clarification_answers`, `feature_delivery_tasks`, `feature_task_issues`, `implementation_records`, `bug_reports`, `bug_fix_tasks`

**Backend**:
- Feature review routes (trigger review run, list items, triage)
- LLM executors: `ReviewProductInContext`, `ReviewUxInContext`, `ReviewTechInContext`, `RefineProductFromIssues`, `RefineUxFromIssues`, `RefineTechFromIssues`, `ReviewFeatureInContext`, `RefineFeatureFromIssues`, `ReviewUserDocsInContext`, `ReviewArchDocsInContext`, `RefineUserDocsFromIssues`, `RefineArchDocsFromIssues`
- Task planning routes (clarifications, auto-answer, generate, list tasks)
- LLM executors: `GenerateTaskClarifications`, `AutoAnswerTaskClarifications`, `GenerateFeatureTaskList`, `ReviewFeatureCohesion`, `RecommendNextFeature`
- Implementation record route (`POST /features/:id/implementation-records`)
- Feature issue CRUD routes
- Bug report routes (`GET/POST /features/:id/bugs`, `GET/PATCH /bugs/:id`, `POST /bugs/:id/fix-tasks`, `POST /bugs/:id/verify`)
- `GenerateBugFixTasks` and `VerifyBugFix` LLM executors
- Bug lifecycle enforcement (see §3.17)

**Frontend**:
- `ReviewPanel` wired to feature artifact review items (product/UX/tech/user docs/arch docs specifications)
- Tasks tab in `FeatureEditorPage`:
  - Clarification questions list with answer input
  - Generated task list view
- Bugs tab in `FeatureEditorPage`:
  - List of linked bug reports with status badges
  - Bug report creation form (linked to sandbox run, PR, environment snapshot)
  - Fix task generation trigger
  - Verification evidence attachment
- `FeatureTaskPage` (standalone task planning view)
- `IssueCard` component

**Acceptance criteria**:
- Review jobs produce BLOCKER/WARNING/SUGGESTION items on product/UX/tech/user docs/arch docs specifications
- Users can set items to DONE, ACCEPTED, or IGNORED
- All BLOCKERs cleared — specification approval becomes available
- With an approved tech specification, task clarifications can be generated and answered
- Delivery task list generates from answered clarifications
- `ReviewFeatureCohesion` quality gate runs before tasks are executable (`StressTestTaskPlan` is wired into the pipeline in M9)
- Bug reports can be created, linked to a feature and sandbox run, and tracked through the lifecycle (`open → in_progress → fixed → verified → closed`)
- Closing a bug as verified requires evidence (verification run ID, test results, or reviewer sign-off)
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M7 — Mission Control Auto-Advance and Orchestration

**Goal**: Mission Control (already the project landing page since M2) is extended with full auto-advance controls, stage orchestration, and implementation staleness surfacing.

**Deliverables**:

**Schema additions** (new migrations):
- `auto_advance_sessions` — auto-advance session lifecycle (status, current step, paused_reason enum: `quality_gate_blocker | job_failed | policy_mismatch | manual_pause | budget_exceeded | needs_human`, automation flags including `auto_approve_when_clear` and `skip_review_steps`, timestamps)

**Backend**:
- Auto-advance service (`apps/api/src/services/auto-advance.ts`)
- Auto-advance routes (`POST start/stop/resume/reset`, `GET status`, `POST step`)
- Phase gate service (`apps/api/src/services/phase-gate-service.ts` — pure function)
- Phase gate route (`GET /projects/:id/phase-gates`)
- Next-actions route (`GET /projects/:id/next-actions`)
- `onJobComplete` callback in JobScheduler wired to auto-advance service

**Frontend**:
- `MissionControlPage` with:
  - `MissionControlTubeMap` — tube-map stage visualiser
  - `NextActionsPanel` — ordered next-action queue with manual trigger button
  - `AutoAdvanceControlsCard` — start/stop/resume/reset/step controls with creativity mode selector and skip-review toggle
  - `AutoAdvanceBanner` — session status indicator
  - `MissionActivityTimeline` — event log
  - `MissionStatsStrip` — progress statistics
- `WorkflowSettingsPage` (`/settings/workflow`) — review-loop and auto-advance configuration (creativity mode defaults, auto-approve thresholds)
- `useAutoAdvance` hook
- `useNextActions` hook
- `mission-control-api.ts` client module

**Acceptance criteria**:
- Phase gate checklist reflects live state in real time (SSE-reactive)
- Next-actions panel shows the correct next automatable step given current project state
- Auto-advance start/stop/resume/reset/step all work end-to-end
- Auto-advance pauses when a quality gate job raises a blocker
- Auto-advance correctly resumes and picks up the next step after the blocker is resolved
- Auto-advance stage ordering includes the user-flow phase between overview and blueprint work
- Tube-map visualiser highlights the current stage and marks all prior stages as completed; advancing to the next stage updates the visualiser within 2 seconds via SSE
- Implementation staleness: features where the approved tech specification has changed since implementation are flagged in Mission Control with a next-action to re-implement the feature
- All session state transitions have integration test coverage
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M8 — Sandbox Execution Runner

**Goal**: Users can launch isolated container-based sandbox runs to execute feature-level implementations using OpenCode, capture artifacts, and produce PRs with attached evidence.

**Deliverables**:

**Schema additions** (new migrations):
- `sandbox_runs`, `sandbox_milestone_sessions`, `sandbox_milestone_session_tasks`, `logbook_versions`, `memory_chunks`, `context_packs`

**Backend**:
- Sandbox run routes (enqueue, list, get, cancel, artifacts download)
- Sandbox container management routes (list, dispose)
- Sandbox options route (repos, features, context packs for run configuration)
- Milestone session routes (`ExecuteMilestoneSession`)
- LLM executors: `ImplementChange`, `TestAndVerify`, `ExecuteMilestoneSession`
- `BuildContextPack` executor (assembles bounded context snapshot from memory chunks)
- `RepoFingerprint` executor (captures repo tree summary into memory chunks)
- Append-only run event storage
- Artifact storage (logs, diffs, test reports) with download support

**Frontend**:
- `DevelopPage` with:
  - `RunListCard` — list of sandbox runs with status badges
  - `SelectedRunCard` — detailed run view with event log and artifact downloads
  - `SandboxSessionsPanel` — milestone session orchestration controls
  - `ManagedContainersCard` — container lifecycle management with dispose button
  - `AddRepoPanel` — attach a repository to the project
  - `DevelopContextPacksDebugPage` — developer-only inspection and regeneration view for planning/coding packs
- `ExecutionSettingsPage` (`/settings/execution`) — sandbox runner configuration (Docker host, resource limits, timeout defaults)
- `LLMStreamPanel` — streaming LLM output panel
- `ActiveJobCard` — current running job status card

**Acceptance criteria**:
- Sandbox run enqueues, starts a container with OpenCode, executes the feature task bundle, and stores artifacts
- Container is started, used, and removed after the run completes (no orphaned containers remain after a successful run)
- Artifacts (logs, diffs) are accessible and downloadable from the API
- Sandbox run can be cancelled and the associated container stopped
- Milestone session orchestrates multiple feature-level runs in dependency order
- `RepoFingerprint` writes memory chunks for the repo tree
- `BuildContextPack` assembles planning/coding context packs from memory chunks and approved artifacts, recording omission lists and staleness metadata
- Verification runs can reuse a warm-start workspace and apply bounded writable remediation when needed
- No-op implement runs are treated as terminal success rather than blocking completion
- All run events are append-only in the database; no in-place mutation
- The guided onboarding flow scaffolded in M2 is completed: a new user can now proceed from project creation through to a sandbox run that produces a PR with attached evidence, demonstrating the full pipeline end-to-end
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M9 — MCP Server and Quality Gates

**Goal**: External LLM-native agents can interact with Quayboard via MCP. All five quality gate executors are fully wired into the auto-advance pipeline with robust failure handling.

**Deliverables**:

**MCP Server**:
- `apps/mcp/` package with full MCP server
- Tool definitions for all tool groups (projects, overview documents, blueprints, milestones, features, artifacts, jobs, questions, conversations, settings, debug)
- HTTP client wrapper (`client.ts`) proxying to Quayboard API
- Configuration from environment variables (`config.ts`)
- Agent usage instructions (`instructions.ts`)
- Build and start scripts; no pnpm banner pollution on stdout

**Quality Gates**:
- Executor implementations for all five quality gate job types:
  - `AssessProjectIntent`
  - `ValidateArtifactQuality`
  - `GenerateAssumptionLedger`
  - `CheckCrossArtifactConsistency`
  - `StressTestTaskPlan`
- Shared quality schemas in `packages/shared/src/schemas/automation-quality.ts` fully populated
- Auto-advance correctly pauses on gate failure and resumes on resolution
- Creativity policy applied consistently to all generation jobs
- Job retry logic: configurable retry ceiling, escalation to `failed` after max retries
- Budget/stop conditions: max token spend, max wall-clock time per session

**Acceptance criteria**:
- MCP server starts without writing non-protocol output to stdout
- All MCP tool calls successfully proxy to the Quayboard REST API and return correct data
- Agent can: create a project, answer questionnaire questions, list features, read blueprints, manage jobs — all via MCP tool calls
- All five quality gate jobs execute, produce structured output conforming to shared schemas, and correctly update auto-advance session state
- Auto-advance pauses when a gate returns a BLOCKER and resumes once the blocker is resolved
- Creativity mode set at session start is present in the `llm_runs` record for every generation job in that session
- All quality gate executors are mockable in CI — no live LLM required
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M10 — Tool Registry and Governance

**Goal**: Establish the tool system that registers, governs, and audits every capability available to LLM jobs and external agents. Tool group toggles and budget caps are configurable per project. All invocations are logged with redacted evidence.

**Deliverables**:

**Schema additions** (new migrations):
- `tool_catalog_versions`, `tool_definitions`, `tool_policy_snapshots`, `tool_invocations`

**Backend**:
- Tool registry data structure and seeding (initial catalog version from code)
- Tool catalog API (`GET /tool-catalog`) with auth-scope filtering
- Project tool policy CRUD (`GET/PUT /projects/:id/tool-policy`) with versioned snapshots
- Tool policy enforcement layer: group check, budget check, sandbox constraint check, schema validation — integrated into job executor dispatch
- Tool Visibility Set profiles (`planning_small`, `planning_rich`, `review`, `execution_prep`, `execution`, `assets`) applied per job type
- Tool Catalog injection generator: builds the filtered tool list for LLM prompt context from registry + TVS + policy
- `tool_intent` structured output parsing and validation in planning executors
- Tool invocation logging (append-only) with redaction pipeline
- Execution token minting and validation for sandbox runs and provider calls
- Budget tracking service: per-project consumption against configured caps
- Misuse detection: hallucinated tool rejection, repeated policy block detection

**Frontend**:
- Tool policy section in Project Setup page:
  - Tool group toggles (planning, review, repo, sandbox, assets, integrations) with impact warnings
  - Budget caps configuration (LLM token/cost per period, asset generation count/cost)
  - Sandbox command category toggles (auto-derived from sandbox defaults where possible)
  - Provider allowlist configuration
- Budget consumption indicator in Project Context Header
- Budget dashboard card on Mission Control (consumption vs caps, trend)
- Tool invocation log visible in Mission Control activity timeline (integrated, not a separate page)
- Policy change events in Mission Control timeline

**Acceptance criteria**:
- Tool catalog is seeded on first server start and queryable via API
- New projects receive a default tool policy with planning + review enabled; sandbox and assets activate when configured in Project Setup
- Tool group toggles correctly restrict which tools are available to LLM job executors
- Budget caps prevent tool invocations when exceeded and return structured "budget exceeded" errors
- All tool invocations (successful and blocked) are logged with redacted inputs/outputs
- Tool Visibility Sets correctly filter the tool catalog injected into LLM prompts per job type
- `tool_intent` proposals from planning jobs are validated against policy before execution
- Execution tokens scope sandbox runs to the intended tool set and expire correctly
- MCP tool exposure respects the project's tool policy and API key scopes
- Hallucinated tool calls (tool_id not in catalog) are rejected and logged
- Policy changes create a new versioned snapshot visible in Mission Control timeline
- Project Context Header shows active tool groups and budget consumption
- All new routes, services, and tables have unit or integration tests
- No live LLM provider required for tool system tests (mocked)
- User-facing documentation exists for tool policy configuration
- Internal architecture documentation exists for the tool registry, enforcement layer, and invocation logging

---

### M11 — Import Flow and Repository Memory

**Goal**: Teams can import existing projects from GitHub (or local filesystem). Repository memory (docs and subsystem summarisation) is built after import and refreshed on new commits. Feature conversations provide a conversational intake path.

**Deliverables**:

**Schema additions** (new migrations):
- `feature_conversation_threads`, `feature_conversation_messages`

**Import path vs. scratch path**:

Imported projects follow a different phase sequence to scratch projects:

| Phase | Scratch path | Import path |
|---|---|---|
| Questionnaire | Required (14 questions) | **Skipped** — project state moves directly from `IMPORTING_B` to `READY_PARTIAL` once memory chunks are built |
| Overview document generation | From questionnaire answers via `GenerateProjectOverview` | From memory chunks (repo tree + docs summaries) via `GenerateProjectOverview` with a `source=import` flag; no questionnaire answers required |
| Phase gate: "questionnaire complete" sub-gate | Checked | **Skipped** — not applicable for imports |
| Remaining phases (blueprint, milestones, features, ...) | Standard | Standard — identical from overview document onwards |

The M2 `NewProjectPage` "import chooser" option is present but routes to a stub page (with a clear "available in a future release" message) until this milestone delivers `ImportProjectPage`.

**Backend**:
- GitHub import flow: repo selection, OAuth/token auth, initial fingerprint trigger; project state transitions `EMPTY → IMPORTING_A → IMPORTING_B → READY_PARTIAL`
- Local filesystem import flow: path input, validation, fingerprint trigger; same state transitions
- `GenerateProjectOverview` executor extended with `source=import` mode: uses memory chunks in place of questionnaire answers when invoked on an imported project
- LLM executor implementations:
  - `DocsSummarise` — summarise documentation directories into memory chunks
  - `SubsystemSummarise` — summarise key subsystems into memory chunks
- `RunQuestionWorker` executor — surfaces LLM-generated questions to the project owner for resolution
- Memory chunk refresh triggered by repo fingerprint on new commits (last-seen SHA tracking)
- `FeatureConversationTurn` executor — LLM-driven conversational feature intake
- Feature intake executors: `CreateFeature`, `CreateFeatureRevision`, `ApplyFeatureProposals`, `DeduplicateFeatures` — apply and deduplicate feature proposals generated during conversation turns

**Frontend**:
- `ImportProjectPage` — GitHub repo picker with OAuth/token flow, local path input
- Feature conversation thread UI — threaded conversational intake with proposal rendering

**Acceptance criteria**:
- User can import a GitHub repository and see a project created with initial memory chunks populated
- Docs and subsystem summarisation jobs run after import and produce memory chunks that do not exceed the configured token cap
- Context packs built from imported projects contain summarised content (not raw file dumps) and do not exceed the configured profile token cap
- Question worker surfaces open questions to users and stores answers for LLM context reuse
- Feature conversation threads allow conversational intake leading to feature proposals
- Memory chunks refresh correctly when a new commit SHA is detected on the tracked branch
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M12 — OAuth, RBAC, and API Keys

**Goal**: Extend the authentication foundation from M1 with OAuth login, role-based access control per project, and scoped API keys for external integrations.

> **Prerequisite**: M1 provides the `users` table, session middleware, and basic email/password login. All routes from M2–M11 are already auth-protected. This milestone adds multi-user collaboration, roles, and external access.

Before M12, project access is single-owner: the authenticated creating user is the only actor authorised for that project's routes. Collaboration, membership, and project-level roles do not exist before this milestone.

**Deliverables**:

**Schema additions** (new migrations):
- `project_members`, `api_keys`, `oauth_accounts`

**Backend**:
- OAuth provider support (GitHub as first provider): `/auth/github`, `/auth/github/callback`
- `oauth_accounts` table linking provider credentials to users
- Role-based access control: `admin`, `reviewer`, `viewer` roles per project
- `project_members` join table linking users to projects with roles
- Authorisation middleware: check user's role on the target project for every project-scoped route
- API key management: `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id`
- API key authentication middleware for MCP and external integrations (accepts `Authorization: Bearer <api-key>` as an alternative to session cookies)
- Rate limiting on authentication endpoints (10 requests/minute for login/register, 100/minute for API key auth)

**Frontend**:
- OAuth callback handler (GitHub login button on login page)
- User profile settings page (name, avatar, password change, linked OAuth accounts)
- Project member management UI (invite by email, role assignment, remove)
- API key management UI (create with scope selection, list, revoke)
- Navigation updates: user avatar in header, logout option

**Acceptance criteria**:
- OAuth login via GitHub works end-to-end: redirect, callback, user creation or linking
- Users with `viewer` role receive 403 on all mutating project routes (POST, PATCH, DELETE)
- Users with `reviewer` role can triage review items and approve artifacts but receive 403 on project settings changes
- Users with `admin` role have full access to all project routes
- Users who are not members of a project receive 403 on all project-scoped routes
- API keys authenticate MCP and external API calls correctly, scoped to specific projects
- API keys can be revoked and immediately stop authenticating
- Rate limiting returns 429 after exceeding the configured threshold
- Existing tests from M2–M11 continue to pass (auth middleware does not break existing flows)
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M13 — Collaboration and Notifications

**Goal**: Team members can comment on artifacts, mention each other, assign review responsibilities, and receive notifications about events that require their attention.

**Deliverables**:

**Schema additions** (new migrations):
- `comments`, `notifications`

**Backend**:
- Comments table (`comments`) with polymorphic attachment (overview document, feature, product specification, UX specification, tech specification, project blueprint)
- Comment CRUD routes (`POST/GET/PATCH/DELETE /comments`)
- @-mention parsing and resolution to user IDs
- Review assignment routes: assign a user to review a specific artifact
- Notifications table (`notifications`) with type, recipient, read/unread status, link to source
- Notification routes: `GET /notifications` (with unread count), `POST /notifications/:id/read`, `POST /notifications/read-all`
- Notification triggers: review requested, blocker raised, artifact approved, comment mention, job failure
- Optional email digest: daily or weekly summary of unread notifications (configurable)
- SSE events for real-time notification delivery

**Frontend**:
- Comment thread component — inline comments on any artifact view (overview document, feature specifications, blueprints)
- @-mention autocomplete in comment input
- Notification centre (bell icon in header with unread badge, dropdown panel with notification list)
- Review assignment UI within the artifact workflow panel
- Activity feed per project showing recent comments, approvals, and status changes
- Notification preferences page in user settings (email digest frequency, notification types)

**Acceptance criteria**:
- Comments can be added to overview documents, feature specifications, and project blueprints; each comment stores author, timestamp, and attachment target
- @-mentions in comments create a notification record for the mentioned user within 1 second
- Review assignments create a notification record for the assigned reviewer
- Notification centre displays accurate unread count; marking a notification as read decrements the count immediately
- SSE delivers notification events to connected clients within 2 seconds of the triggering action
- Email digest job runs on schedule (daily/weekly as configured) and sends an email only if there are unread notifications
- Activity feed returns events in reverse chronological order, filtered by project, with pagination
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M14 — Analytics and Audit Dashboard

**Goal**: Provide visibility into LLM usage, cost, quality metrics, and a searchable audit trail for compliance and operational oversight.

**Deliverables**:

**Schema additions** (new migrations):
- Performance indexes on `llm_runs(project_id, created_at)`, `jobs(project_id, type, status, created_at)`, `artifact_approvals(artifact_id, created_at)`, and `sandbox_runs(project_id, created_at)` to meet the <500ms audit log query requirement

**Backend**:
- Analytics aggregation routes:
  - `GET /analytics/projects/:id/llm-usage` — token counts, model breakdown, cost estimates per project
  - `GET /analytics/projects/:id/velocity` — features completed per week, tasks completed per week, time-to-approval
  - `GET /analytics/projects/:id/quality` — quality gate pass rates, review item severity distribution, average review rounds
  - `GET /analytics/overview` — cross-project summary for portfolio view
- Audit log route: `GET /audit-log` — searchable, filterable log surfacing `llm_runs`, `jobs`, `artifact_approvals`, and sandbox run data
- Audit log filters: date range, project, event type, user, job type
- Cost estimation service: configurable per-token cost rates per model

**Frontend**:
- `AnalyticsDashboardPage` (new top-level route `/analytics`):
  - LLM usage chart — token consumption over time, by model, by job type
  - Cost tracker — estimated spend per project with configurable rate cards
  - Velocity chart — features and tasks completed over time
  - Quality metrics — gate pass rates, average review rounds, blocker frequency
- `AuditLogPage` (new top-level route `/audit-log`):
  - Searchable, paginated table of all system events
  - Filters: date range, project, event type, user, job type
  - Drill-down to individual LLM run details (input/output, tokens, model, template)
- `ProjectAnalyticsPage` (`/projects/:id/analytics`) — per-project LLM usage, velocity, and quality metrics (mirrors the global analytics dashboard scoped to one project)

**Acceptance criteria**:
- LLM usage endpoint returns token counts that match the sum of `prompt_tokens + completion_tokens` from `llm_runs` for the requested project and date range
- Cost estimates equal `token_count * configured_rate` for each model, verifiable by manual calculation against `llm_runs` data
- Velocity endpoint returns feature and task completion counts per week that match `COUNT(*) WHERE status = 'completed' AND completed_at` within each week boundary
- Quality endpoint returns gate pass rates that match `passed / total` counts from `artifact_review_runs` for the requested project
- Audit log returns paginated results within 500ms for a database with 10,000+ `llm_runs` and `jobs` records
- Audit log supports filtering by date range, project ID, event type, and job type; each filter correctly narrows results
- Drill-down from an audit log entry to the associated `llm_runs` record displays the full input, output, model, and token counts
- Portfolio overview endpoint aggregates metrics across all projects the authenticated user has access to
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M15 — Export and Project Templates

**Goal**: Teams can export planning artifacts for external stakeholders in markdown and PDF formats, and start new projects from reusable templates to accelerate onboarding.

**Deliverables**:

**Schema additions** (new migrations):
- `templates`

**Backend**:
- Export routes:
  - `GET /projects/:id/export/overview` — export overview document as markdown or PDF
  - `GET /projects/:id/export/blueprint` — export project blueprints as markdown or PDF
  - `GET /features/:id/export` — export feature with all specifications as markdown or PDF
  - `GET /projects/:id/export/full` — combined export of all artifacts
- PDF generation service (server-side markdown-to-PDF rendering using a headless browser or a library such as `puppeteer` or `md-to-pdf`)
- Project templates:
  - `templates` table (name, description, pre-filled questionnaire answers, decision card defaults, recommended milestone structure)
  - `GET/POST /templates` — list and create templates
  - `POST /projects` extended to accept `templateId` — pre-populate from template
  - System-provided starter templates (e.g., "SaaS Web App", "Mobile App", "API Service", "CLI Tool")

**Frontend**:
- Export buttons on overview document, blueprint, and feature editor pages (markdown and PDF download)
- Template browser in the New Project flow — select a template or start blank
- Template management page in Settings (create, edit, delete templates)

**Acceptance criteria**:
- Overview documents, blueprints, and feature specifications can be exported as markdown
- PDF export produces a document that renders all markdown headings, tables, and code blocks without layout breakage
- PDF export completes within 10 seconds for a full project export
- Projects created from a template have questionnaire answers and decision cards pre-populated correctly
- System templates cover at least 3 common project archetypes
- Template CRUD is restricted to users with `admin` role
- All export routes require authentication and respect project membership
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M16 — Global Search and Integrations

**Goal**: Users can search across all project content, and external tools (Slack, CI systems, custom services) receive webhook notifications about key events.

**Deliverables**:

**Schema additions** (new migrations):
- `webhooks`, `webhook_deliveries`

**Backend**:
- Global search:
  - `GET /search?q=...&project=...&type=...` — full-text search across projects, features, overview documents, feature specifications, tasks
  - PostgreSQL `tsvector` / `tsquery` full-text indexing on all text content columns (overview document content, feature specification markdown, feature summaries, delivery task descriptions)
  - Search results include entity type, title, matched excerpt, and link
  - Results scoped to projects the authenticated user has access to
- Webhook integrations:
  - `webhooks` table (URL, HMAC secret, event type filter, project scope, active/inactive flag)
  - `webhook_deliveries` table (webhook ID, event type, payload, HTTP response status, retry count, timestamps)
  - `GET/POST/DELETE /webhooks` — webhook CRUD (restricted to project `admin` role)
  - `POST /webhooks/:id/test` — send a test payload to verify connectivity
  - Outbound webhook delivery on configurable events: `artifact.approved`, `review.blocker_raised`, `job.completed`, `job.failed`, `sandbox.run_finished`
  - Webhook delivery with HMAC-SHA256 signature in `X-Quayboard-Signature` header
  - Failed deliveries retry with exponential backoff (1m, 5m, 30m), max 5 attempts, logged in `webhook_deliveries`
  - Pre-built Slack payload formatter (Slack Block Kit messages with action context and links)

**Frontend**:
- Global search bar in the header with results dropdown (projects, features, specifications, tasks)
- Search results page with faceted filtering (by project, entity type, date range)
- Webhook management page in Settings (add, test, view delivery log, delete webhooks)
- Slack integration setup guide (inline documentation with webhook URL and event configuration)

**Acceptance criteria**:
- Search for a known feature title returns the correct result as the first match
- Search results return within 500ms for a database with 1,000+ features across 50+ projects
- Search respects project membership — users only see results from projects they belong to
- Webhooks fire within 5 seconds of the triggering event
- Webhook payloads include a valid HMAC-SHA256 signature that can be verified by the receiver
- Failed webhook deliveries are retried up to 5 times with exponential backoff
- Webhook delivery history is visible in the management UI with status codes and timestamps
- Test webhook sends a correctly formatted payload and reports the HTTP response status
- Slack-formatted payloads include the event type, project name, artifact title, and a deep link to the relevant page
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

---

### M17 — Canonicalization and Planning Document Removal

**Goal**: Promote any remaining durable project truth out of this planning document so the repository can remain understandable and governable after the roadmap is complete and this document is deleted.

**Deliverables**:
- Full review of this planning document against the implemented repository
- ADRs added for any still-relevant architectural or workflow decisions that are not already captured elsewhere
- `README.md`, contributor docs, and architecture docs updated so they describe the current system without depending on milestone-planning text for canonical truth
- Obsolete roadmap-only statements removed or replaced with final-state documentation
- Explicit deletion of `docs/planning/quayboard-project-outline.md` once the canonicalization pass is complete

**Acceptance criteria**:
- Removing `docs/planning/quayboard-project-outline.md` does not leave any implemented subsystem, workflow rule, or architectural decision without a canonical home in the repository
- Durable decisions live in ADRs when they are normative, and in architecture or contributor docs when they are descriptive
- `README.md` and relevant docs describe the final repository state without referring readers back to the deleted planning document for essential understanding
- The planning document is deleted in the same milestone that completes the canonicalization pass

---

## 5. Glossary

> **Code identifiers vs document terminology**: This document uses user-facing names (e.g., "overview document", "feature specification"). The codebase retains shorter internal identifiers in table names, route paths, component names, and job type enums. The mapping is:
>
> | Document term | Code identifiers |
> |---|---|
> | Overview document | Table: `one_pagers`, routes: `/one-pager`, components: `OnePager*`, jobs: `*OnePager`, `*ProjectOverview` |
> | User flow | Table: `use_cases`, routes: `/user-flows`, jobs: `GenerateUseCases`, `DeduplicateUseCases` |
> | Feature specification (product / UX / tech) | Tables: `product_specs`, `ux_specs`, `tech_specs`, routes: `/product-revisions`, `/ux-revisions`, `/tech-revisions` |
> | User documentation | Tables: `user_doc_specs`, `user_doc_revisions`, routes: `/user-doc-revisions` |
> | Architecture documentation | Tables: `arch_doc_specs`, `arch_doc_revisions`, routes: `/arch-doc-revisions` |
> | Bug report | Tables: `bug_reports`, `bug_fix_tasks`, routes: `/bugs` |
> | Encrypted secret | Table: `encrypted_secrets`, routes: `/secrets` |
> | Project blueprint | Table: `project_blueprints`, routes: `/blueprints/*` |
> | Decision deck | Table: `decision_cards`, routes: `/decision-cards` |
> | Delivery task | Table: `feature_delivery_tasks` |
> | Sandbox run | Table: `sandbox_runs`, routes: `/sandbox/runs` |
>
> Do not rename existing code identifiers to match this document. Both naming layers are intentional — short names in code, descriptive names in documentation.

| Term | Definition |
|---|---|
| **Overview document** | The canonical project overview document generated from questionnaire answers. Versioned as immutable snapshots. Stored in the `one_pagers` table. |
| **Questionnaire** | The structured 14-question onboarding interview that seeds overview document generation. |
| **User flow** | A user-facing journey definition derived from the approved overview document or authored manually. Stored internally in the `use_cases` table and used to drive coverage checks, blueprint gating, and milestone planning. |
| **Decision deck** | A set of architectural and UX decision cards with LLM recommendations and alternatives. Generated after the user-flow set is approved. |
| **Decision card** | A single card within the decision deck representing one key architectural or UX choice. |
| **Project blueprint** | A high-level architecture document at the project level. Two types: **UX blueprint** (information architecture, flows, wireframes) and **tech blueprint** (stack, schema, API design, infrastructure). Generated from decision deck selections. |
| **Feature** | A single unit of project scope (a screen, system, service, pipeline, etc.) within the feature catalogue. Has a canonical ID (e.g., "F-001"). |
| **Feature specification** | A detailed specification for one workstream of a feature. Five types: **product specification** (what and why), **UX specification** (wireframes, flows, interaction), **tech specification** (implementation plan, data model, API), **user documentation** (user-facing guides and help text), **architecture documentation** (internal design rationale and data flow). Each is independently versioned and approvable. |
| **Revision** | An immutable content snapshot. Feature specifications, features, and project blueprints all use revisions for version history. |
| **Version** | Used specifically for overview document version history (version 1, version 2, etc.). |
| **Milestone** | A grouping of features representing a deliverable increment. Lifecycle: `draft -> approved -> completed`. Every feature belongs to exactly one milestone. |
| **Delivery task** | An atomic, ordered implementation work item generated from approved feature specifications. Has an ID like `PROJ-00001`. All pending tasks for a feature are bundled and executed together in a single sandbox run. |
| **Sandbox run** | A single `ImplementChange` or `TestAndVerify` execution inside an isolated Docker container using OpenCode. An `ImplementChange` run bundles all pending tasks for a feature into a single cohesive implementation; `TestAndVerify` can reuse a warm-start worktree and apply bounded remediation. Produces artifacts (logs, diffs, test reports) and optionally a PR. |
| **Milestone session** | An orchestrated sequence of feature-level sandbox runs across all features in a milestone, respecting dependency order. |
| **OpenCode** | A headless agentic code editor (`opencode-ai` npm package) used as the sole sandbox runtime. Operates fully autonomously inside the sandbox container, executing the feature task bundle against the cloned repository. Configured with the project's LLM provider settings at container initialisation. |
| **Context pack** | An immutable LLM context snapshot assembled from memory chunks, approved artifacts, and run metadata. The durable architecture distinguishes `planning` packs and `coding` packs; legacy profiles remain only for backward compatibility. |
| **Planning pack** | A context-pack type for non-coding jobs. Includes broad project context such as the overview document, approved user flows, blueprints, repo summaries, and feature metadata. |
| **Coding pack** | A context-pack type for implementation and verification jobs. Includes approved specs, task detail, repo summaries, and remediation context needed for `ImplementChange` and `TestAndVerify`. |
| **Memory chunk** | A bounded summary stored in the logbook: repo tree, docs summaries, subsystem summaries. |
| **Logbook** | The internal versioned project knowledge store. Contains memory chunks and coverage tracking. |
| **Review item** | A finding from an LLM review pass on an artifact. Severity: `BLOCKER`, `WARNING`, `SUGGESTION`. Status: `OPEN`, `DONE`, `ACCEPTED`, `IGNORED`. |
| **Quality gate** | An automated check that can pause auto-advance when issues are found. Five types: intent assessment, artifact quality, assumption ledger, cross-artifact consistency, task stress test. |
| **Auto-advance** | The automated stage orchestrator that progresses a project through phases, pausing at quality gates and human review points. |
| **Mission Control** | The orchestration dashboard: stage map, next-actions panel, auto-advance controls, activity timeline. |
| **Phase gate** | A structured checklist of conditions that must be met before progressing from one phase to the next. |
| **Creativity mode** | A per-session policy (`off / scoped / balanced / high`) applied to LLM generation prompts. |
| **Instance Readiness** | The first-run deployment check shown before project onboarding. Verifies instance-level prerequisites such as database access, encryption key presence, Docker availability, artifact storage, and enabled provider adapters. |
| **Project Setup** | The readiness phase where a user connects a repository, configures the LLM provider, sets sandbox defaults, and establishes evidence/docs policy before proceeding to the questionnaire. |
| **Project Context Header** | A persistent, sticky header strip shown on every project-scoped page displaying project state, connected repo, model profile, sandbox policy, tool policy summary, and setup readiness. |
| **User documentation** | User-facing documentation generated from the product specification — guides, help text, API docs. A workstream track within the Feature Editor. |
| **Architecture documentation** | Internal architecture documentation generated from the tech specification — design rationale, data flow, integration points. A workstream track within the Feature Editor. |
| **Bug report** | A structured defect record linked to a feature, tech revision, sandbox run, and PR. Tracks through `open → in_progress → fixed → verified → closed`. Closing requires verification evidence. |
| **Implementation staleness** | The state where a feature's approved tech specification has been updated since it was last implemented (`head_tech_revision_id != implemented_tech_revision_id`). Surfaced in Mission Control and the Feature Editor as "Implementation out of date" with a next-action to re-implement the feature. |
| **Project state** | The lifecycle phase of a project record. `EMPTY` → project created, nothing configured. `BOOTSTRAPPING` → setup in progress (scratch path). `IMPORTING_A` → import started, fingerprint job queued. `IMPORTING_B` → fingerprint and memory-chunk jobs running. `READY_PARTIAL` → memory built (import) or questionnaire started (scratch) but overview document not yet generated. `READY` → overview document approved; all phases available. |
| **Encrypted secret** | A credential (GitHub PAT, LLM API key, OAuth token) stored encrypted at rest in the `encrypted_secrets` table. Write-only via API — never returned in responses. Scoped to a project and injected into sandbox containers at runtime. |
| **MCP server** | The Model Context Protocol adapter that allows external LLM-native agents to interact with Quayboard via structured tool calls. |
| **Action level** | A governance tier assigned to each registered tool: `READ`, `WRITE`, `ELEVATED_WRITE`, `EXECUTE`, `PROVIDER_CALL`, `ADMIN`. Determines enforcement rules and policy checks applied before execution. |
| **Execution token** | A short-lived, scoped capability token authorising a specific set of tool invocations for a project, with a maximum invocation count and wall-clock expiry. Prevents replay and lateral actions. |
| **Tool** | A registered capability that an LLM job or external agent can invoke. Every tool has an action level, input/output schema, and is subject to project tool policy enforcement. |
| **Tool Catalog** | The filtered set of tool descriptions, schemas, and guidance injected into an LLM executor's prompt context. Derived from the tool registry, the active Tool Visibility Set, and the project's tool policy. |
| **Tool invocation** | An append-only log record of a tool being called, including redacted inputs/outputs, policy snapshot, actor, and status (succeeded, failed, or blocked_by_policy). |
| **Tool policy** | Per-project, versioned configuration controlling which tool groups are enabled, budget caps for LLM and asset usage, sandbox command categories, and provider allowlists. |
| **Tool registry** | The versioned catalog of all tool definitions available in Quayboard, stored in `tool_catalog_versions` and `tool_definitions` tables. Every job records the catalog version used. |
| **Tool Visibility Set (TVS)** | A deterministic profile (e.g., `planning_small`, `execution`) controlling which tools an LLM job type can see and use. Applied automatically per job type and filtered by project tool policy. |
| **`tool_intent`** | A structured output from planning LLM jobs proposing tool calls (tool_id + inputs + rationale) for system validation and execution. The model proposes; Quayboard enforces and executes. |

---

*End of document*
