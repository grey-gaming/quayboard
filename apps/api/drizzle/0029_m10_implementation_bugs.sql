CREATE TABLE "bug_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "feature_id" text REFERENCES "feature_cases"("id") ON DELETE set null,
  "implementation_record_id" text REFERENCES "implementation_records"("id") ON DELETE set null,
  "description" text NOT NULL,
  "status" text NOT NULL,
  "reported_by_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "latest_fix_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "latest_fix_sandbox_run_id" text,
  "latest_fix_pull_request_url" text,
  "last_fix_error" text,
  "fixed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bug_reports_status_check"
    CHECK ("status" in ('open', 'in_progress', 'fixed'))
);
CREATE INDEX "bug_reports_project_id_idx" ON "bug_reports" ("project_id");
CREATE INDEX "bug_reports_feature_id_idx" ON "bug_reports" ("feature_id");
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" ("status");

ALTER TABLE "sandbox_runs"
  ADD COLUMN "bug_report_id" text REFERENCES "bug_reports"("id") ON DELETE set null;

ALTER TABLE "sandbox_runs" DROP CONSTRAINT IF EXISTS "sandbox_runs_kind_check";
ALTER TABLE "sandbox_runs"
  ADD CONSTRAINT "sandbox_runs_kind_check"
  CHECK ("kind" in ('implement', 'verify', 'ci_repair', 'project_review', 'project_fix', 'bug_fix'));
