# Planning Workflow

This document describes the M5 planning workflow as it exists in the repository.

## Scope

The current planning workflow builds on the M1 foundation and M2-M3 planning flow:

- instance readiness checks
- project creation and Mission Control
- project setup with GitHub PAT verification, project-scoped LLM selection, and sandbox verification
- questionnaire persistence, autosave, and blank-answer auto-fill
- overview document generation, version history, restore, and approval
- Product Spec generation, version history, restore, and approval
- UX decision-tile generation, selection persistence, acceptance, and UX Spec approval
- Technical decision-tile generation, selection persistence, acceptance, and Technical Spec approval
- user-flow generation, manual editing, deduplication, and approval
- milestone planning, active-milestone lifecycle control, milestone design doc generation, milestone reconciliation, and milestone completion
- feature catalogue management, feature revisions, dependency graph reads, milestone feature-set generation, and feature rollups
- feature workstream editing for Product, UX, Tech, User Docs, and Architecture Docs, including revision history and approvals

## Data Model

- `questionnaire_answers` stores one JSON answer map per project plus completion timestamps
- `one_pagers` stores immutable overview versions with a canonical flag
- `product_specs` stores immutable Product Spec versions with a canonical flag
- `use_cases` stores mutable user flows with archive support
- `decision_cards` stores kind-specific UX and technical decision tiles, selections, and acceptance state
- `project_blueprints` stores versioned UX and technical spec revisions with canonical pointers
- `artifact_approvals` backs UX/Technical Spec and milestone design doc approval records
- `milestones` stores milestone ordering, completion state, and milestone-level reconciliation status
- `milestone_use_cases` stores milestone-to-user-flow coverage links
- `milestone_design_docs` stores immutable milestone design doc revisions with a canonical flag
- `feature_cases` stores feature identity, milestone assignment, lifecycle metadata, and archive state
- `feature_revisions` stores immutable feature content snapshots
- `feature_dependencies` stores direct build-order links between features
- `feature_edges` stores derived read-only graph edges for graph consumers
- `feature_product_specs`, `feature_ux_specs`, `feature_tech_specs`, `feature_user_doc_specs`, and `feature_arch_doc_specs` store one identity row per feature workstream
- `feature_product_revisions`, `feature_ux_revisions`, `feature_tech_revisions`, `feature_user_doc_revisions`, and `feature_arch_doc_revisions` store immutable workstream snapshots
- `projects` stores overview approval time plus user-flow approval snapshot metadata
- `project_counters` now issues stable feature keys such as `F-001`
- `settings` holds project-scoped setup state: LLM config, sandbox defaults, and evidence policy

## Runtime Services

- `systemReadinessService` checks database access, encryption key presence, Docker access, artifact storage, and enabled provider adapters
- `projectSetupService` owns repo verification, LLM config/verification, sandbox config/verification, and checklist status
- `questionnaireService`, `onePagerService`, `productSpecService`, `userFlowService`, `blueprintService`, `milestoneService`, `featureService`, `featureWorkstreamService`, and `artifactApprovalService` manage planning artifacts
- `phaseGateService` now treats the Features phase as requiring at least one feature with an approved Product workstream revision
- `nextActionsService` now scopes detailed planning to the active milestone only, then continues through task planning and milestone reconciliation before milestone completion
- `jobService` and the in-process `jobScheduler` execute planning jobs asynchronously and publish SSE updates, including milestone generation, milestone design doc generation, milestone feature-set generation, milestone feature-set rewrite, and feature workstream generation
- sandbox delivery runs (`implement`, `verify`, bug/project fixes, and milestone CI repair) use at least 4096 MB even when an older project saved a lower memory limit; large Docker logs are captured with bounded buffers and fall back to tailed logs instead of replacing the real run failure
- milestone design generation now uses a structured JSON draft, deterministic local validation of flow/group/screen ownership, one targeted repair pass, and a renderer that persists the validated result as markdown
- milestone feature-set generation, milestone feature-set rewrite, feature workstream generation, and feature task-list generation follow a draft-plus-review/rewrite LLM pattern so the persisted artifact is the reviewed result rather than the first pass
- feature and task generation prompts now use milestone design guidance and sibling-boundary context to reduce task-sized feature fragmentation and milestone-coverage gaps; active-milestone task planning is interleaved with implementation so each later feature planner sees code delivered by earlier feature runs
- planning and sandbox prompts now include core-capability integrity guidance: small vertical slices are allowed, but core product promises must not be downgraded into fake production success, empty artifact references, canned generated output, or silent stubs; missing providers or sources should be represented through adapter/test-double boundaries or visible blockers
- blueprint generation now self-repairs accepted decision selections when `ValidateDecisionConsistency` reports conflicts, then reruns validation before creating the UX or Technical spec
- auto-advance retries only failures marked retryable by job execution; malformed structured-output failures, transient provider failures (`429`, `5xx`, timeout, and connection errors), and exhausted blueprint decision-conflict repairs now re-enter the bounded job retry loop, while prompt/context-limit failures still pause cleanly

## External Adapters

- GitHub repo verification is PAT-based only in M2-M4
- LLM providers supported in M2-M4 are Ollama and OpenAI-compatible
- Sandbox verification checks Docker daemon availability, pulls the base image when needed, and attempts to start a throwaway container

## UI Surface

- `/login` and `/register` surface the live instance readiness gate before auth submission is allowed
- `/setup/instance`
- `/projects/new`
- `/projects/:id`
- `/projects/:id/setup`
- `/projects/:id/questions`
- `/projects/:id/one-pager`
- `/projects/:id/product-spec`
- `/projects/:id/ux-spec`
- `/projects/:id/technical-spec`
- `/projects/:id/user-flows`
- `/projects/:id/milestones`
- `/projects/:id/features`
- `/projects/:id/features/:featureId`
- `/projects/:id/import` as a future-release stub
