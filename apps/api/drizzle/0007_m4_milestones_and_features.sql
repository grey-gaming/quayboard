CREATE TABLE "milestones" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "status" text NOT NULL,
  "approved_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "milestones_status_check" CHECK ("status" in ('draft', 'approved', 'completed'))
);

CREATE INDEX "milestones_project_id_idx" ON "milestones" ("project_id");
CREATE UNIQUE INDEX "milestones_project_id_position_key" ON "milestones" ("project_id", "position");

CREATE TABLE "milestone_use_cases" (
  "milestone_id" text NOT NULL REFERENCES "milestones"("id") ON DELETE cascade,
  "use_case_id" text NOT NULL REFERENCES "use_cases"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "milestone_use_cases_milestone_id_idx" ON "milestone_use_cases" ("milestone_id");
CREATE INDEX "milestone_use_cases_use_case_id_idx" ON "milestone_use_cases" ("use_case_id");
CREATE UNIQUE INDEX "milestone_use_cases_milestone_id_use_case_id_key" ON "milestone_use_cases" ("milestone_id", "use_case_id");

CREATE TABLE "milestone_design_docs" (
  "id" text PRIMARY KEY NOT NULL,
  "milestone_id" text NOT NULL REFERENCES "milestones"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "is_canonical" boolean DEFAULT false NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "milestone_design_docs_milestone_id_idx" ON "milestone_design_docs" ("milestone_id");
CREATE UNIQUE INDEX "milestone_design_docs_milestone_id_version_key" ON "milestone_design_docs" ("milestone_id", "version");

CREATE TABLE "feature_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "milestone_id" text NOT NULL REFERENCES "milestones"("id") ON DELETE restrict,
  "feature_key" text NOT NULL,
  "kind" text NOT NULL,
  "priority" text NOT NULL,
  "status" text NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feature_cases_status_check" CHECK ("status" in ('draft', 'approved', 'in_progress', 'completed', 'archived')),
  CONSTRAINT "feature_cases_kind_check" CHECK ("kind" in ('screen', 'menu', 'dialog', 'system', 'service', 'library', 'pipeline', 'placeholder_visual', 'placeholder_non_visual')),
  CONSTRAINT "feature_cases_priority_check" CHECK ("priority" in ('must_have', 'should_have', 'could_have', 'wont_have'))
);

CREATE INDEX "feature_cases_project_id_idx" ON "feature_cases" ("project_id");
CREATE INDEX "feature_cases_milestone_id_idx" ON "feature_cases" ("milestone_id");
CREATE UNIQUE INDEX "feature_cases_project_id_feature_key_key" ON "feature_cases" ("project_id", "feature_key");

CREATE TABLE "feature_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "feature_revisions_feature_id_idx" ON "feature_revisions" ("feature_id");
CREATE UNIQUE INDEX "feature_revisions_feature_id_version_key" ON "feature_revisions" ("feature_id", "version");

CREATE TABLE "feature_dependencies" (
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "depends_on_feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feature_dependencies_self_check" CHECK ("feature_id" <> "depends_on_feature_id")
);

CREATE INDEX "feature_dependencies_feature_id_idx" ON "feature_dependencies" ("feature_id");
CREATE INDEX "feature_dependencies_depends_on_feature_id_idx" ON "feature_dependencies" ("depends_on_feature_id");
CREATE UNIQUE INDEX "feature_dependencies_feature_id_depends_on_feature_id_key" ON "feature_dependencies" ("feature_id", "depends_on_feature_id");

CREATE TABLE "feature_edges" (
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "related_feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "edge_type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feature_edges_edge_type_check" CHECK ("edge_type" in ('depends_on', 'leads_to', 'contains')),
  CONSTRAINT "feature_edges_self_check" CHECK ("feature_id" <> "related_feature_id")
);

CREATE INDEX "feature_edges_feature_id_idx" ON "feature_edges" ("feature_id");
CREATE INDEX "feature_edges_related_feature_id_idx" ON "feature_edges" ("related_feature_id");
CREATE UNIQUE INDEX "feature_edges_feature_id_related_feature_id_edge_type_key" ON "feature_edges" ("feature_id", "related_feature_id", "edge_type");

ALTER TABLE "artifact_approvals" DROP CONSTRAINT IF EXISTS "artifact_approvals_artifact_type_check";
ALTER TABLE "artifact_approvals"
  ADD CONSTRAINT "artifact_approvals_artifact_type_check"
  CHECK ("artifact_type" in ('blueprint_ux', 'blueprint_tech', 'milestone_design_doc'));
