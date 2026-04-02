CREATE TABLE "logbook_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "coverage_flags" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "logbook_versions_project_id_idx" ON "logbook_versions" ("project_id");

CREATE TABLE "memory_chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "logbook_version_id" text REFERENCES "logbook_versions"("id") ON DELETE set null,
  "key" text NOT NULL,
  "content" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "memory_chunks_project_id_idx" ON "memory_chunks" ("project_id");
CREATE UNIQUE INDEX "memory_chunks_project_id_key_key" ON "memory_chunks" ("project_id", "key");

CREATE TABLE "context_packs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "feature_id" text REFERENCES "feature_cases"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "version" integer NOT NULL,
  "content" text NOT NULL,
  "summary" text NOT NULL,
  "stale" boolean NOT NULL DEFAULT false,
  "omission_list" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "source_coverage" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "context_packs_type_check" CHECK ("type" in ('planning', 'coding'))
);

CREATE INDEX "context_packs_project_id_idx" ON "context_packs" ("project_id");
CREATE INDEX "context_packs_feature_id_idx" ON "context_packs" ("feature_id");
CREATE UNIQUE INDEX "context_packs_project_id_feature_id_type_version_key"
  ON "context_packs" ("project_id", "feature_id", "type", "version");

CREATE TABLE "sandbox_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "feature_id" text REFERENCES "feature_cases"("id") ON DELETE cascade,
  "milestone_id" text REFERENCES "milestones"("id") ON DELETE cascade,
  "task_planning_session_id" text REFERENCES "feature_task_planning_sessions"("id") ON DELETE set null,
  "context_pack_id" text REFERENCES "context_packs"("id") ON DELETE set null,
  "triggered_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "outcome" text,
  "container_id" text,
  "base_commit_sha" text,
  "head_commit_sha" text,
  "branch_name" text,
  "pull_request_url" text,
  "cancellation_reason" text,
  "workspace_archive_path" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sandbox_runs_kind_check" CHECK ("kind" in ('implement', 'verify')),
  CONSTRAINT "sandbox_runs_status_check" CHECK ("status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);

CREATE INDEX "sandbox_runs_project_id_idx" ON "sandbox_runs" ("project_id");
CREATE INDEX "sandbox_runs_feature_id_idx" ON "sandbox_runs" ("feature_id");
CREATE INDEX "sandbox_runs_milestone_id_idx" ON "sandbox_runs" ("milestone_id");
CREATE INDEX "sandbox_runs_status_idx" ON "sandbox_runs" ("status");

CREATE TABLE "sandbox_run_events" (
  "id" text PRIMARY KEY NOT NULL,
  "sandbox_run_id" text NOT NULL REFERENCES "sandbox_runs"("id") ON DELETE cascade,
  "sequence" integer NOT NULL,
  "level" text NOT NULL,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sandbox_run_events_level_check" CHECK ("level" in ('info', 'warning', 'error'))
);

CREATE INDEX "sandbox_run_events_run_id_idx" ON "sandbox_run_events" ("sandbox_run_id");
CREATE UNIQUE INDEX "sandbox_run_events_run_id_sequence_key" ON "sandbox_run_events" ("sandbox_run_id", "sequence");

CREATE TABLE "sandbox_run_artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "sandbox_run_id" text NOT NULL REFERENCES "sandbox_runs"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "content_type" text NOT NULL,
  "storage_path" text NOT NULL,
  "size_bytes" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "sandbox_run_artifacts_run_id_idx" ON "sandbox_run_artifacts" ("sandbox_run_id");
CREATE UNIQUE INDEX "sandbox_run_artifacts_run_id_name_key" ON "sandbox_run_artifacts" ("sandbox_run_id", "name");

CREATE TABLE "sandbox_milestone_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "milestone_id" text NOT NULL REFERENCES "milestones"("id") ON DELETE cascade,
  "triggered_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "status" text NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sandbox_milestone_sessions_status_check" CHECK ("status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);

CREATE INDEX "sandbox_milestone_sessions_project_id_idx" ON "sandbox_milestone_sessions" ("project_id");
CREATE INDEX "sandbox_milestone_sessions_milestone_id_idx" ON "sandbox_milestone_sessions" ("milestone_id");

CREATE TABLE "sandbox_milestone_session_tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "sandbox_milestone_session_id" text NOT NULL REFERENCES "sandbox_milestone_sessions"("id") ON DELETE cascade,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "sandbox_run_id" text REFERENCES "sandbox_runs"("id") ON DELETE set null,
  "status" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sandbox_milestone_session_tasks_status_check" CHECK ("status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);

CREATE INDEX "sandbox_milestone_session_tasks_session_id_idx" ON "sandbox_milestone_session_tasks" ("sandbox_milestone_session_id");
CREATE UNIQUE INDEX "sandbox_milestone_session_tasks_session_id_position_key"
  ON "sandbox_milestone_session_tasks" ("sandbox_milestone_session_id", "position");
