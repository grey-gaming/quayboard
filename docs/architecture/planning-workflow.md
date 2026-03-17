# Planning Workflow

This document describes the M2 planning workflow as it exists in the repository.

## Scope

M2 adds the scratch-path onboarding flow on top of the M1 auth/API foundation:

- instance readiness checks
- project creation and Mission Control
- project setup with GitHub PAT verification, project-scoped LLM selection, and sandbox verification
- questionnaire persistence
- overview document generation, version history, restore, and approval
- user-flow generation, manual editing, deduplication, and approval

## Data Model

- `questionnaire_answers` stores one JSON answer map per project plus completion timestamps
- `one_pagers` stores immutable overview versions with a canonical flag
- `use_cases` stores mutable user flows with archive support
- `projects` now stores overview approval time plus user-flow approval snapshot metadata
- `settings` holds project-scoped setup state: LLM config, sandbox defaults, evidence policy, and tool-policy preview

## Runtime Services

- `systemReadinessService` checks database access, encryption key presence, Docker access, artifact storage, and enabled provider adapters
- `projectSetupService` owns repo verification, LLM config/verification, sandbox config/verification, and checklist status
- `questionnaireService`, `onePagerService`, and `userFlowService` manage the planning artifacts
- `jobService` and the in-process `jobScheduler` execute planning jobs asynchronously and publish SSE updates

## External Adapters

- GitHub repo verification is PAT-based only in M2
- LLM providers supported in M2 are Ollama and OpenAI-compatible
- Sandbox verification checks Docker daemon availability and attempts to start a throwaway container using a locally available base image

## UI Surface

- `/login` and `/register` surface the live instance readiness gate before auth submission is allowed
- `/setup/instance`
- `/projects/new`
- `/projects/:id`
- `/projects/:id/setup`
- `/projects/:id/one-pager`
- `/projects/:id/user-flows`
- `/projects/:id/import` as a future-release stub
