# Mission Control

Mission Control is the central orchestration surface for a Quayboard project. It shows you where you are in the planning workflow, what needs to happen next, and lets you hand control to the Auto-Advance engine to run the workflow autonomously.

Navigate here via the project sidebar or directly at `/projects/:id`.

---

## Page Layout

### Auto-Advance Banner

A narrow status strip at the top of the page. It reflects the current auto-advance session state at a glance:

| State | Appearance |
|-------|-----------|
| **idle** | Muted grey — no session is running |
| **running** | Green — automation is active |
| **paused** | Amber — paused; reason shown inline |
| **completed** | Blue — all automatable steps have been executed |
| **failed** | Red — session has failed |

When the session is paused, the banner also shows the pause reason (e.g. "Needs human input", "Job failed").

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
- **Auto-Advance Controls Card** — start, stop, resume, and reset the automation session (see below).
- **Mission Activity Timeline** — chronological feed of recent background jobs with status and timestamp.
- **Recent Jobs Panel** — full table of tracked background jobs.

---

## Auto-Advance

Auto-Advance automates the planning workflow by inspecting the current next-action and enqueuing the appropriate background job without manual intervention.

### Session Lifecycle

```
idle → running → paused ↔ running → completed
                       ↘ failed
```

- **Start** — creates a session and begins executing steps.
- **Stop** — pauses the session with reason `manual_pause`. No job currently running is cancelled; the pause takes effect at the next step boundary.
- **Resume** — clears the pause and immediately advances to the next step.
- **Step once** — advances exactly one step then pauses again. Useful for cautious, supervised progression.
- **Reset** — deletes the session entirely and returns to idle. Safe to use at any time.

### Pause Reasons

When the session pauses automatically (i.e. not via the Stop button), the banner explains why:

| Reason | Meaning |
|--------|---------|
| `needs_human` | The next action requires a human decision (approval gate, manual edit) |
| `job_failed` | A background job returned a failure outcome |
| `manual_pause` | You clicked Stop |
| `quality_gate_blocker` | A phase gate is not satisfied |
| `policy_mismatch` | Session settings conflict with instance policy |
| `budget_exceeded` | LLM token budget was exceeded |

After resolving the underlying issue, click **Resume** to continue.

### Session Settings

When a session exists, the Controls Card shows the session's configuration:

- **Creativity mode** — controls how adventurous the LLM is when generating planning artefacts:
  - `conservative` — tighter, less speculative outputs
  - `balanced` (default) — recommended for most projects
  - `creative` — more varied, exploratory outputs
- **Skip review steps** — when enabled, approval gates are bypassed and the workflow continues automatically.

These settings are fixed for the lifetime of a session. Reset and start a new session to change them.

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
