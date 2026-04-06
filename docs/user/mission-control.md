# Mission Control

Mission Control is the central orchestration surface for a Quayboard project. It shows you where you are in the planning workflow, what needs to happen next, and lets you hand control to the Auto-Advance engine to run the workflow autonomously.

Navigate here via the project sidebar or directly at `/projects/:id`.

---

## What is Auto-Advance?

Auto-Advance is Quayboard's autonomous planning engine. Once started, it works through every stage of the project planning workflow — generating specs, blueprints, user flows, milestones, and per-feature documentation — without you having to manually trigger each step.

Think of it as an AI co-planner that reads where your project currently is, decides what needs to happen next, kicks off the appropriate background job, waits for the result, and repeats — until the project is fully planned or it reaches a decision that only you can make.

### What does it produce?

By the time Auto-Advance completes, your project will have a full set of planning artefacts:

| Artefact | Description |
|----------|-------------|
| **Project Overview** | High-level summary of the project's goals and scope |
| **Product Spec** | Full product requirements document |
| **UX Blueprint** | UX decision deck and UX specification |
| **Tech Blueprint** | Tech decision deck and technical specification |
| **User Flows** | Use cases and user journey maps |
| **Milestone Plan** | Phased delivery roadmap with milestone design docs |
| **Per-Feature Docs** | For each feature: product spec, UX spec, tech spec, user docs, and architecture docs |

---

## The Planning Workflow

Auto-Advance works through seven phases in sequence. Each phase builds on the last.

```
╔═════════════════════════════════════════════════════════════════╗
║                     THE PLANNING WORKFLOW                       ║
╚═════════════════════════════════════════════════════════════════╝

  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 1 · Setup                                             │
  │  Configure project  →  Auto-answer questionnaire             │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 2 · Overview & Product Spec                           │
  │  Generate overview  →  Approve  →  Generate product spec     │
  │  →  Approve                                                  │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 3 · UX Decisions & Blueprint                          │
  │  Generate decisions  →  Select options  →  Accept deck       │
  │  →  Generate UX blueprint                                    │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 4 · Tech Decisions & Blueprint                        │
  │  Generate decisions  →  Select options  →  Accept deck       │
  │  →  Generate tech blueprint                                  │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 5 · User Flows & Milestones                           │
  │  Generate user flows  →  Approve  →  Generate milestones     │
  │  →  Generate milestone design doc                            │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 6 · Feature Documentation                             │
  │                                                              │
  │  Create features from milestone plan                         │
  │         │                                                    │
  │         └──► For each feature (running in parallel):         │
  │                Product spec  →  UX spec  →  Tech spec        │
  │                →  User docs  →  Architecture docs            │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHASE 7 · Delivery Review                                   │
  │                                                              │
  │  Review all outputs for gaps or inconsistencies              │
  │    ├─ No gaps found   ──►  COMPLETE ✓                        │
  │    └─ Gaps found      ──►  Fix and re-review  (up to 3×)     │
  └──────────────────────────────────────────────────────────────┘
```

### Phase-by-phase breakdown

**Phase 1 — Setup**
Sets up the project structure and auto-answers any remaining questionnaire fields using the information already provided.

**Phase 2 — Overview & Product Spec**
Generates a high-level project overview, then builds the full product requirements spec from it. Both documents go through an approval step — automatic when *Skip review steps* is on, or paused for your review if not.

**Phase 3 — UX Decisions & Blueprint**
Generates a set of UX decision cards covering layout approach, navigation patterns, component style, and more. Auto-Advance selects the recommended option for each, accepts the decision deck, then generates the full UX blueprint.

**Phase 4 — Tech Decisions & Blueprint**
Same pattern as Phase 3 but for the technology stack — database, API style, auth strategy, and other architectural choices.

**Phase 5 — User Flows & Milestones**
Generates user flows (use cases and journeys), an overall milestone plan, and a milestone design document that describes what gets delivered in each phase. Milestone order is canonical, generated milestone titles stay thematic, and milestone generation runs an internal review pass before results are saved. Milestone design-doc generation also runs a repair and cross-milestone consistency pass so vague deferrals to an unspecified future phase are not silently left behind.

**Phase 6 — Feature Documentation**
Creates individual feature records from the milestone plan, then generates five documents per feature. Features can be processed in parallel (controlled by *Max concurrent jobs*), so this phase scales with the size of your project.

**Phase 7 — Delivery Review**
Runs a final project-wide review loop over the delivered work. It checks documentation, code quality, and missing or incomplete user flows, fixes the findings, and reviews again. In Auto-Advance this loop repeats up to three times before pausing for manual intervention. Once clean, the session completes.

---

## Session States

```
                            start / resume
            ┌────────────────────────────────────────┐
            │                                        ▼
        ┌───┴──┐                              ┌──────────┐
        │ IDLE │◄── reset ───────────────────►│ RUNNING  │──────► COMPLETED
        └──────┘                              └────┬─────┘
                                                   │
                              pause (auto or manual)│
                                                   ▼
                                             ┌──────────┐
                                             │  PAUSED  │
                                             └──────────┘
                                           (reason shown in banner)
```

| State | What it means |
|-------|--------------|
| **Idle** | No session exists. The project has not been started or was reset. |
| **Running** | Auto-Advance is actively working through steps. |
| **Paused** | Execution has stopped. A reason is shown in the banner. |
| **Completed** | Every step has been executed and the delivery review passed. |

---

## Pause Reasons

When Auto-Advance pauses automatically, the banner tells you why and what to do next:

| Reason | What happened | What to do |
|--------|--------------|------------|
| `needs_human` | The next step requires a decision only you can make — for example, a document approval that is not set to auto-approve | Complete the action shown in the Next Actions panel, then click **Resume** |
| `job_failed` | A background job failed after three automatic retries | Check the Recent Jobs panel for details, then click **Resume** to retry |
| `manual_pause` | You clicked **Stop** | Click **Resume** when you are ready to continue |
| `milestone_repair_limit_reached` | Milestone coverage auto-repair ran three times and the active milestone still has unresolved coverage gaps | Review the milestone in **Milestones**, make any edits needed, then click **Resume** |
| `review_limit_reached` | The delivery review found issues but has already cycled three times without fully resolving them | Review the generated output manually, make any edits needed, then click **Resume** |

---

## How Jobs Run

Each step in the workflow is executed as a background job. Here is what happens under the hood:

```
  Auto-Advance calls advanceStep()
         │
         ▼
  What is the next action?
         │
         ├─► Automatable step
         │        │
         │        └─► Enqueue job ──► Job runs in background
         │                                     │
         │                          ┌──────────┴───────────┐
         │                          │                      │
         │                       SUCCESS                FAILURE
         │                          │                      │
         │                     Advance to             Retry (up to 3×)
         │                     next step                   │
         │                          │              Still failing after 3?
         │                          │                      │
         │                          │               PAUSE: job_failed
         │                          │
         └─► Needs human input       │
                  │                  │
                  └─► PAUSE: needs_human
```

### Automatic retries

If a job fails, Auto-Advance retries it automatically up to **three times** before pausing. In Phase 6, where features may be running in parallel, Quayboard waits for the active batch to finish and counts the whole batch as one retry attempt if any item failed. Transient failures — network hiccups, LLM timeouts — typically resolve within a retry or two without any action needed from you.

### Parallel feature processing

In Phase 6, features are processed in parallel. You control how many run simultaneously with the **Max concurrent jobs** setting (1–10). Higher values finish faster but consume more LLM capacity at once.

```
  features_create
         │
         ├──► Feature A ──► product → ux → tech → user docs → arch docs
         ├──► Feature B ──► product → ux → tech → user docs → arch docs
         ├──► Feature C ──► product → ux → tech → user docs → arch docs
         └──► Feature D ──► product → ux → tech → user docs → arch docs
                (all running simultaneously, up to Max concurrent jobs)
```

Each feature's workstream is independent — if one feature pauses for an approval, the others keep running.

### The delivery review cycle

After all feature documentation is complete, Auto-Advance runs a delivery review — a project-wide quality-check loop that inspects documentation, code quality, and user-flow completeness across the whole project:

```
  All feature docs complete
         │
         ▼
  Run delivery review
         │
         ├─── No gaps ────────────────────────────► COMPLETED ✓
         │
         └─── Gaps found
              (e.g. documentation gaps, code quality issues, missing user flows)
                       │
                       ▼
                Fix job runs
                (updates the affected code or docs)
                       │
                       ▼
                Review again ── up to 3 cycles total
                       │
                       └─ Issues remain after 3 cycles?
                                  │
                                  ▼
                           PAUSE: review_limit_reached
                           (manual review needed)
```

---

## Session Settings

These settings are chosen when starting a session and cannot be changed mid-session. To change them, reset the session and start a new one.

| Setting | Options | Effect |
|---------|---------|--------|
| **Creativity mode** | `conservative` / `balanced` / `creative` | Controls how adventurous the AI is when generating content. `balanced` is recommended for most projects. Use `conservative` for tightly-scoped projects and `creative` for more exploratory briefs. |
| **Skip review steps** | on / off | When on, approval gates (overviews, specs, decision decks) are bypassed and the workflow advances automatically. When off, Auto-Advance pauses at each approval for your review. |
| **Max concurrent jobs** | 1–10 | How many feature workstreams run in parallel during Phase 6. Defaults to 1. Increase this to speed up large projects. |
| **Auto-approve when clear** | on / off | Automatically approves a document as soon as its artefact is ready, without pausing for confirmation. |

---

## Controls

| Button | What it does |
|--------|-------------|
| **Start** | Creates a new session and begins running from where the project currently is. |
| **Stop** | Pauses at the next step boundary. The current job is not interrupted mid-run. |
| **Resume** | Clears the pause and immediately continues from where it stopped. |
| **Step once** | Advances exactly one step, then pauses. Useful for inspecting output between steps. |
| **Reset** | Deletes the session entirely and returns to idle. Safe to use at any time. |

---

## Page Layout

### Auto-Advance Banner

A status strip at the top of the page showing the current session state at a glance:

| State | Appearance |
|-------|-----------|
| **Idle** | Muted grey — no session is running |
| **Running** | Green — automation is active |
| **Paused** | Amber — paused; reason shown inline |
| **Completed** | Blue — all automatable steps have been executed |
| **Failed** | Red — session has failed |

When the session is paused, the banner also shows the pause reason (for example, "Needs human input" or "Job failed").

### Stats Strip

Four tiles summarising the project's planning state:

- **Phases passed / total** — how many phase gates are currently satisfied
- **Next actions** — number of pending next steps
- **Auto-advance status** — current session status
- **Current step** — the action key being executed, or "—" when idle

### Main Grid

The page splits into two columns on large screens:

**Left column**
- **Next Actions Panel** — waterfall of the next steps required to advance the project. Each action links directly to the relevant page.
- **Phase Gate Checklist** — per-phase checklist of all gates and their pass/fail status.

**Right column**
- **Auto-Advance Controls Card** — start, stop, resume, and reset the automation session (see above).
- **Mission Activity Timeline** — chronological feed of recent background jobs with status and timestamp.
- **Recent Jobs Panel** — full table of tracked background jobs.

---

## Workflow Settings

Instance-level defaults for Auto-Advance can be found at **Settings → Workflow Settings** (`/settings/workflow`):

- **Default creativity mode** — applied when starting new sessions
- **Skip review steps by default** — whether approval gates are bypassed by default

> **Note:** Persisted workflow settings and full review-loop configuration are coming in a future milestone.

---

## Implementation Staleness Detection

If a feature's Technical Spec has been revised after an implementation record was produced, the Next Actions Panel will show a **"Re-implement stale feature: \<name\>"** action for that feature. This ensures implementation records always reflect the latest approved spec.

Auto-Advance will pick up this staleness action and re-enqueue the relevant implementation job automatically when running.

During milestone delivery, feature implementation runs reuse one milestone delivery branch and one open PR. When the milestone is completed, Quayboard merges that PR, deletes the remote milestone branch, and future follow-up fixes start from the latest default branch on a fresh fix branch.
