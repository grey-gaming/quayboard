# Planning Workflow

Quayboard's current UI supports the scratch-path planning workflow:

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
   - click **Complete Setup** after the repository, LLM, and sandbox checks are green to unlock Questions, Overview, Product Spec, User Flows, and Import
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
15. Generate, edit, deduplicate, and approve user flows.
16. Open **Blueprint** and generate the decision deck once user flows are approved.
17. Review each decision card, choose the recommended or alternative option, or save a custom choice.
18. Generate the **UX Blueprint** and **Tech Blueprint**, or save either one manually if you prefer to author it directly.
19. Run review on each blueprint, triage the review items, and clear all blocker items.
20. Approve both canonical blueprints.

The import path remains a stub for now, and Quayboard does not yet execute sandbox implementation runs or create pull requests.
