# Planning Workflow

Quayboard's current UI supports the scratch-path planning workflow:

1. Sign in or register.
2. Review **Instance Readiness** and resolve any failing checks.
3. Create a project.
4. Complete **Project Setup**:
   - store a GitHub PAT
   - connect a GitHub repository
   - choose a project-scoped LLM provider and model
   - define sandbox defaults
   - verify LLM connectivity
   - verify sandbox startup
5. Answer the questionnaire in **Overview Document**.
6. Generate the project description and overview document.
7. Review history or restore an older overview version if needed.
8. Approve the current overview document.
9. Generate, edit, deduplicate, and approve user flows.

The import path remains a stub for now, and Quayboard does not yet execute sandbox implementation runs or create pull requests.
