# ADR 008: Prefix Feature Workstream Tables And Use Approved Project Specs As Inputs

- Status: accepted
- Date: 2026-03-22
- Deciders: project maintainers
- Supersedes: n/a
- Superseded by: n/a

## Context

Milestone 5 introduces feature-level product, UX, technical, user-documentation, and architecture-documentation workstreams. The long-range outline reused short table names such as `product_specs`, but the repository already uses `product_specs` for the project-level Product Spec workflow delivered earlier. Leaving both layers on the same names would create a collision and make the code harder to reason about.

The same milestone originally described feature workstream generation as one-pager driven. By the time M5 starts in the live repo, approved project-level Product Spec, UX Spec, and Technical Spec artifacts already exist and are the stronger source of truth for feature-level document generation.

## Decision

Quayboard will use explicit `feature_*` prefixes for all five feature workstream table families:

- `feature_product_specs` / `feature_product_revisions`
- `feature_ux_specs` / `feature_ux_revisions`
- `feature_tech_specs` / `feature_tech_revisions`
- `feature_user_doc_specs` / `feature_user_doc_revisions`
- `feature_arch_doc_specs` / `feature_arch_doc_revisions`

Feature workstream generation will use the approved project-level Product Spec, UX Spec, and Technical Spec as source inputs. The one-pager is not a direct generator input for M5 feature workstreams.

## Consequences

This keeps project-level and feature-level specification data clearly separated, avoids schema-name collisions, and makes job prompts align with the strongest approved planning artifacts rather than an earlier-stage overview document.

The tradeoff is that the roadmap text must be updated to match implemented repo reality, and the code identifiers differ slightly from the older outline wording.
