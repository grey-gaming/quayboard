# ADR 002: pnpm Minimum Version Policy

- Status: accepted
- Date: 2026-03-14
- Deciders: project maintainers
- Supersedes: n/a
- Superseded by: n/a

## Context

The project outline lists pnpm `9.x` as the preferred package manager version. The M0 implementation needs a concrete repository policy for local development and CI, but an exact repository pin would create unnecessary friction when newer pnpm majors remain compatible with the workspace.

The repo also needs the policy expressed in a way that works across local environments and CI without forcing a `packageManager` field to a single exact version.

## Decision

Quayboard will document pnpm `>=9` as the supported minimum version.

- The repo will express the requirement through documentation and the `engines` field rather than an exact `packageManager` pin.
- CI may use a newer pnpm major when it remains compatible with the repo.
- If a future change requires a stricter pnpm pin or a higher minimum version, that change should update or supersede this ADR.

## Consequences

This keeps the M0 setup compatible with pnpm 9 and newer while avoiding unnecessary version churn in local environments. It also gives CI room to track a newer supported pnpm release without treating that as a repo-wide lock.

The tradeoff is that the project does not get exact package-manager reproducibility from Corepack pinning alone. If reproducibility or pnpm feature usage later requires an exact version, the team should revise this policy explicitly.

## Alternatives Considered

- Pinning an exact pnpm 9.x version in `packageManager`
- Adopting pnpm 10 as the only supported version immediately
- Omitting any documented pnpm version policy
