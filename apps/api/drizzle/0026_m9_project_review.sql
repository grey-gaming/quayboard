ALTER TABLE "projects"
  ADD COLUMN "milestone_plan_status" text NOT NULL DEFAULT 'open',
  ADD COLUMN "milestone_plan_finalized_at" timestamptz;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_milestone_plan_status_check"
  CHECK ("milestone_plan_status" in ('open', 'finalized'));

ALTER TABLE "sandbox_runs" DROP CONSTRAINT IF EXISTS "sandbox_runs_kind_check";
ALTER TABLE "sandbox_runs"
  ADD CONSTRAINT "sandbox_runs_kind_check"
  CHECK ("kind" in ('implement', 'verify', 'ci_repair', 'project_review', 'project_fix'));

ALTER TABLE "auto_advance_sessions"
  ADD COLUMN "project_review_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "auto_advance_sessions" DROP CONSTRAINT IF EXISTS "auto_advance_sessions_paused_reason_check";
ALTER TABLE "auto_advance_sessions"
  ADD CONSTRAINT "auto_advance_sessions_paused_reason_check"
  CHECK (
    "paused_reason" is null or "paused_reason" in (
      'quality_gate_blocker',
      'job_failed',
      'policy_mismatch',
      'manual_pause',
      'budget_exceeded',
      'needs_human',
      'milestone_map_repair_limit_reached',
      'milestone_repair_limit_reached',
      'review_limit_reached',
      'ci_fix_budget_exceeded',
      'ci_wait_limit_reached',
      'project_review_limit_reached'
    )
  );

CREATE TABLE "project_review_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "triggered_by_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "status" text NOT NULL,
  "loop_count" integer NOT NULL DEFAULT 0,
  "max_loops" integer NOT NULL DEFAULT 3,
  "auto_apply_fixes" boolean NOT NULL DEFAULT true,
  "branch_name" text,
  "pull_request_url" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "project_review_sessions_status_check"
    CHECK ("status" in ('queued_review', 'running_review', 'queued_fix', 'running_fix', 'needs_fixes', 'clear', 'failed'))
);
CREATE INDEX "project_review_sessions_project_id_idx" ON "project_review_sessions" ("project_id");

CREATE TABLE "project_review_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "project_review_session_id" text NOT NULL REFERENCES "project_review_sessions"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "sequence" integer NOT NULL,
  "sandbox_run_id" text REFERENCES "sandbox_runs"("id") ON DELETE set null,
  "job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "report_markdown" text,
  "summary" jsonb,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "project_review_attempts_kind_check"
    CHECK ("kind" in ('review', 'fix')),
  CONSTRAINT "project_review_attempts_status_check"
    CHECK ("status" in ('queued', 'running', 'succeeded', 'failed'))
);
CREATE INDEX "project_review_attempts_session_id_idx" ON "project_review_attempts" ("project_review_session_id");
CREATE INDEX "project_review_attempts_project_id_idx" ON "project_review_attempts" ("project_id");
CREATE UNIQUE INDEX "project_review_attempts_session_id_sequence_key"
  ON "project_review_attempts" ("project_review_session_id", "sequence");

CREATE TABLE "project_review_findings" (
  "id" text PRIMARY KEY NOT NULL,
  "project_review_attempt_id" text NOT NULL REFERENCES "project_review_attempts"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "category" text NOT NULL,
  "severity" text NOT NULL,
  "finding" text NOT NULL,
  "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "why_it_matters" text NOT NULL,
  "recommended_improvement" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  CONSTRAINT "project_review_findings_category_check"
    CHECK ("category" in ('documentation', 'tests', 'completeness', 'architecture')),
  CONSTRAINT "project_review_findings_severity_check"
    CHECK ("severity" in ('critical', 'high', 'medium', 'low')),
  CONSTRAINT "project_review_findings_status_check"
    CHECK ("status" in ('open', 'resolved', 'accepted', 'ignored', 'superseded'))
);
CREATE INDEX "project_review_findings_attempt_id_idx" ON "project_review_findings" ("project_review_attempt_id");
CREATE INDEX "project_review_findings_project_id_idx" ON "project_review_findings" ("project_id");
