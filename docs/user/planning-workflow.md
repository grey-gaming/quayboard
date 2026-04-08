# Planning Workflow

Quayboard's current UI supports the current planning workflow:

1. Sign in or register.
2. Review **Instance Readiness** and resolve any failing checks.
3. Create a project.
4. Complete **Project Settings**:
   - validate and store a GitHub PAT
   - select a GitHub repository from the accessible repo list
   - choose a project-scoped LLM provider and model
   - if using Ollama, load and select one of the available models; the selection is saved and verified immediately
   - define sandbox defaults; current Develop implementation and verification runs use internet access for dependency lookup and installs even if the saved sandbox egress policy is locked
   - verify OpenAI-compatible LLM connectivity when that provider is selected
   - verify sandbox startup; the first verification can pull the sandbox base image if it is missing locally, but the check does not verify outbound dependency access
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
23. Create milestones manually or queue milestone generation. Generated milestone order is canonical; milestone titles stay thematic rather than carrying the canonical number in the title itself.
24. When Quayboard generates milestones, it runs an internal review pass before saving them so numbering references do not drift from the stored milestone order.
25. Review the **Milestone Design Doc** panel for a draft milestone, generate or edit a design doc until the canonical revision is ready, then approve the milestone. Milestone approval also approves that canonical design-doc revision.
26. Milestone design-doc generation also runs an internal repair and consistency pass before saving so vague deferrals to an unspecified future phase are rewritten into explicit scope and sequencing.
27. Open **Feature Builder** to create the initial catalogue against an approved milestone.
28. Use each milestone section's **New feature** action for manual intake or **Generate features** to seed that milestone from the approved planning documents and canonical milestone design doc.
29. Filter the catalogue by status, kind, or priority while reviewing milestone-grouped feature lists.
30. Open a feature in **Feature Editor**.
31. Manage direct feature dependencies inside the create flow or **Feature Editor**, then use the approved project Product Spec, UX Spec, and Technical Spec as the source context for feature workstream generation.
32. Draft or generate the feature **Product** workstream first, set which downstream workstreams are required, then approve the current Product revision.
33. Draft or generate the feature **UX**, **Tech**, **User Docs**, and **Architecture Docs** workstreams as needed, reviewing revision history and approving each current head revision independently.
34. The **Tasks** tab is present as a placeholder only; delivery-task planning has not landed yet.

The import path remains a stub for now. Quayboard now provides task-planning, sandbox execution, and implementation bug-report workflows. Tool-policy routes are still registered, but the management surface is not implemented yet.
