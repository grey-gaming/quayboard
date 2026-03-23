# Planning Workflow

Quayboard's current UI supports the current planning workflow:

1. Sign in or register.
2. Review **Instance Readiness** and resolve any failing checks.
3. Create a project.
4. Complete **Project Setup**:
   - validate and store a GitHub PAT
   - select a GitHub repository from the accessible repo list
   - choose a project-scoped LLM provider and model
   - if using Ollama, load and select one of the available models; the selection is saved and verified immediately
   - define sandbox defaults
   - verify OpenAI-compatible LLM connectivity when that provider is selected
   - verify sandbox startup; the first verification can pull the sandbox base image if it is missing locally
   - click **Complete Setup** after the repository, LLM, and sandbox checks are green to unlock Questions, Overview, Product Spec, User Flows, Milestones, Features, and Import
5. Answer the questionnaire in **Questions**.
6. Answers save automatically while you type; use **Generate Answers** to fill only the remaining blanks from the saved project name, description, and any existing answers.
7. Click **Next: Generate Overview** to move to **Overview** and start one-pager generation.
8. Review history or restore an older overview version if needed.
9. Edit the overview markdown if needed, then save to create a new version.
10. Approve the current overview document.
11. Generate the **Product Spec** from the approved overview.
12. Review history or restore an older Product Spec version if needed.
13. Edit the Product Spec markdown if needed, then save to create a new version.
14. Approve the current Product Spec.
15. Open **UX Spec** and use the header action to generate the **UX Decision Tiles** once the Product Spec is approved.
16. Review each UX decision tile, choose the recommended or alternative option, or save a custom choice.
17. After every UX decision is selected, click **Accept UX Decisions**.
18. Generate or manually save the **UX Spec**, edit it if needed, then approve the current UX Spec.
19. Open **Technical Spec** after the UX Spec is approved, generate the **Technical Decision Tiles**, select and accept them, then generate or manually save the **Technical Spec**.
20. Edit the Technical Spec if needed, then approve the current Technical Spec.
21. Open **User Flows** after the Technical Spec is approved, generate or refine the journey set, resolve or accept coverage warnings, and approve the current user-flow set.
22. Open **Milestones** after user flows are approved.
23. Create milestones manually or queue milestone generation, then prepare the design doc for each milestone that should accept features.
24. Review the **Milestone Design Doc** panel for a draft milestone, generate or edit a design doc until the canonical revision is ready, then approve the milestone. Milestone approval also approves that canonical design-doc revision.
25. Open **Feature Builder** to create the initial catalogue against an approved milestone.
26. Use the intake drawer for manual features or **Append From Overview** to seed more features from the approved one-pager.
27. Filter the catalogue by status, kind, or priority, then wire direct dependencies and review the dependency graph and rollup summary.
28. Open a feature in **Feature Editor**.
29. Use the approved project Product Spec, UX Spec, and Technical Spec as the source context for feature workstream generation.
30. Draft or generate the feature **Product** workstream first, set which downstream workstreams are required, then approve the current Product revision.
31. Draft or generate the feature **UX**, **Tech**, **User Docs**, and **Architecture Docs** workstreams as needed, reviewing revision history and approving each current head revision independently.
32. The **Tasks** tab is present as a placeholder only; delivery-task planning has not landed yet.

The import path remains a stub for now, and Quayboard does not yet provide the later task-planning, bug-report, or sandbox execution workflows.
