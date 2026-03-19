# Planning Workflow

This document describes the M3 planning workflow as it exists in the repository.

## Scope

The current planning workflow builds on the M1 foundation and M2 onboarding flow:

- instance readiness checks
- project creation and Mission Control
- project setup with GitHub PAT verification, project-scoped LLM selection, and sandbox verification
- questionnaire persistence, autosave, and blank-answer auto-fill
- overview document generation, version history, restore, and approval
- Product Spec generation, version history, restore, and approval
- user-flow generation, manual editing, deduplication, and approval
- decision deck generation and selection persistence
- deck-first UX and tech blueprint generation, manual save, review-item triage, and approval

## Data Model

- `questionnaire_answers` stores one JSON answer map per project plus completion timestamps
- `one_pagers` stores immutable overview versions with a canonical flag
- `product_specs` stores immutable Product Spec versions with a canonical flag
- `use_cases` stores mutable user flows with archive support
- `decision_cards` stores the Blueprint Builder decision deck and user selections
- `project_blueprints` stores versioned UX and tech blueprint revisions with canonical pointers
- `artifact_review_runs`, `artifact_review_items`, and `artifact_approvals` back blueprint review and approval
- `projects` now stores overview approval time plus user-flow approval snapshot metadata
- `settings` holds project-scoped setup state: LLM config, sandbox defaults, and evidence policy

## Runtime Services

- `systemReadinessService` checks database access, encryption key presence, Docker access, artifact storage, and enabled provider adapters
- `projectSetupService` owns repo verification, LLM config/verification, sandbox config/verification, and checklist status
- `questionnaireService`, `onePagerService`, `productSpecService`, `userFlowService`, `blueprintService`, and `artifactReviewService` manage the planning artifacts
- `jobService` and the in-process `jobScheduler` execute planning jobs asynchronously and publish SSE updates, including decision-deck generation, blueprint generation, and blueprint review

## External Adapters

- GitHub repo verification is PAT-based only in M2
- LLM providers supported in M2 are Ollama and OpenAI-compatible
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
- `/projects/:id/user-flows`
- `/projects/:id/blueprint`
- `/projects/:id/import` as a future-release stub
