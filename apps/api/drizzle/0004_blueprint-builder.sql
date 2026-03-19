CREATE TABLE "decision_cards" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "prompt" text NOT NULL,
  "recommendation" jsonb NOT NULL,
  "alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "selected_option_id" text,
  "custom_selection" text,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "decision_cards_project_id_key" ON "decision_cards" USING btree ("project_id", "key");
CREATE INDEX "decision_cards_project_id_idx" ON "decision_cards" USING btree ("project_id");

CREATE TABLE "project_blueprints" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "is_canonical" boolean DEFAULT false NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_blueprints_kind_check" CHECK ("kind" in ('ux', 'tech'))
);

CREATE INDEX "project_blueprints_project_id_idx" ON "project_blueprints" USING btree ("project_id");
CREATE INDEX "project_blueprints_project_id_kind_idx" ON "project_blueprints" USING btree ("project_id", "kind");
CREATE UNIQUE INDEX "project_blueprints_project_id_kind_version_key" ON "project_blueprints" USING btree ("project_id", "kind", "version");

CREATE TABLE "artifact_review_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "artifact_type" text NOT NULL,
  "artifact_id" text NOT NULL,
  "job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "artifact_review_runs_artifact_type_check" CHECK ("artifact_type" in ('blueprint_ux', 'blueprint_tech')),
  CONSTRAINT "artifact_review_runs_status_check" CHECK ("status" in ('queued', 'running', 'succeeded', 'failed'))
);

CREATE INDEX "artifact_review_runs_project_id_idx" ON "artifact_review_runs" USING btree ("project_id");
CREATE INDEX "artifact_review_runs_artifact_idx" ON "artifact_review_runs" USING btree ("project_id", "artifact_type", "artifact_id");

CREATE TABLE "artifact_review_items" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "review_run_id" text NOT NULL REFERENCES "artifact_review_runs"("id") ON DELETE cascade,
  "artifact_type" text NOT NULL,
  "artifact_id" text NOT NULL,
  "severity" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "details" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artifact_review_items_severity_check" CHECK ("severity" in ('BLOCKER', 'WARNING', 'SUGGESTION')),
  CONSTRAINT "artifact_review_items_status_check" CHECK ("status" in ('OPEN', 'DONE', 'ACCEPTED', 'IGNORED')),
  CONSTRAINT "artifact_review_items_artifact_type_check" CHECK ("artifact_type" in ('blueprint_ux', 'blueprint_tech'))
);

CREATE INDEX "artifact_review_items_review_run_id_idx" ON "artifact_review_items" USING btree ("review_run_id");
CREATE INDEX "artifact_review_items_artifact_idx" ON "artifact_review_items" USING btree ("project_id", "artifact_type", "artifact_id");

CREATE TABLE "artifact_approvals" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "artifact_type" text NOT NULL,
  "artifact_id" text NOT NULL,
  "approved_by_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artifact_approvals_artifact_type_check" CHECK ("artifact_type" in ('blueprint_ux', 'blueprint_tech'))
);

CREATE INDEX "artifact_approvals_artifact_idx" ON "artifact_approvals" USING btree ("project_id", "artifact_type", "artifact_id");
CREATE UNIQUE INDEX "artifact_approvals_artifact_id_approved_by_user_id_key" ON "artifact_approvals" USING btree ("artifact_id", "approved_by_user_id");
