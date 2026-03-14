ALTER TABLE "projects"
  ADD COLUMN "one_pager_approved_at" timestamp with time zone,
  ADD COLUMN "user_flows_approved_at" timestamp with time zone,
  ADD COLUMN "user_flows_approval_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "repos"
  ADD COLUMN "verified_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "questionnaire_answers" (
  "project_id" text PRIMARY KEY NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "one_pagers" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "is_canonical" boolean DEFAULT false NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "one_pagers_project_id_idx" ON "one_pagers" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "one_pagers_project_id_version_key" ON "one_pagers" USING btree ("project_id", "version");
--> statement-breakpoint
CREATE TABLE "questions" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "category" text NOT NULL,
  "priority" text NOT NULL,
  "status" text NOT NULL,
  "prompt" text NOT NULL,
  "answer" text,
  "placement_hint" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "questions_project_id_idx" ON "questions" USING btree ("project_id");
--> statement-breakpoint
CREATE TABLE "use_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "user_story" text NOT NULL,
  "entry_point" text NOT NULL,
  "end_state" text NOT NULL,
  "flow_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "coverage_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "done_criteria_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text NOT NULL,
  "archived_at" timestamp with time zone,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "use_cases_project_id_idx" ON "use_cases" USING btree ("project_id");
