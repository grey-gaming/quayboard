# ADR 001: Branch and Verification Policy

- Status: accepted
- Date: 2026-03-14
- Deciders: project maintainers
- Supersedes: n/a
- Superseded by: n/a

## Context

Quayboard is starting from a planning-first repository with agent-driven implementation expected to follow. The project already relies on milestone-gated execution, documentation triggers, and explicit handoff requirements. Without a clear branch and verification policy, agents could work directly on `main`, spread related work across multiple short-lived branches, or push changes without running any meaningful validation.

The policy needs to support two constraints at once:

1. Milestone work should stay grouped so implementation and follow-up bug fixes remain easy to reason about.
2. Verification should be strict enough to prevent careless pushes, but not so rigid that every local push depends on the full future CI matrix.

## Decision

Quayboard will use the following workflow rules:

- Use one dedicated delivery branch per active milestone while that milestone is in progress.
- Do not work directly on `main`.
- Merge the milestone delivery branch through its PR, then delete that remote branch.
- After a milestone branch has been merged and deleted, start follow-up fixes from the current default branch on a fresh fix branch.
- Commit work incrementally to the milestone branch as progress is made.
- Push the milestone branch to `origin` so the remote stays current.
- Before pushing, run the required verification for the change that exists in the repo.
- Do not push known-red work unless explicitly instructed.
- Full CI green status is required before merge, but not every local push must run the full CI-equivalent matrix.
- Verification claims in handoffs and PRs must reflect only checks that were actually run.

## Consequences

This keeps active milestone work cohesive while preventing old delivery branches from becoming long-lived sources of truth after merge. It also creates a clear separation between local push gates and merge gates, which should scale better once the repo has slower integration and end-to-end suites.

The tradeoff is that active milestone branches may stay open longer and accumulate more commits than short-lived task branches, while post-merge fixes now require a fresh branch even when they relate to the same milestone. That is acceptable for this repository because the primary control boundary is the active milestone, not the individual prompt or coding session.

This ADR should be updated or superseded if the team later adopts a different branching model, such as feature branches under each milestone or direct trunk-based development with stricter automation.

## Alternatives Considered

- One branch per coding cycle or prompt
- Direct work on `main` with strong PR review
- Requiring the full test suite before every push
