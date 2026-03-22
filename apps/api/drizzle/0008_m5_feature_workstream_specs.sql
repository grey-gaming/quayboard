CREATE TABLE "feature_product_specs" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "head_revision_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "feature_product_specs_feature_id_key" ON "feature_product_specs" ("feature_id");

CREATE TABLE "feature_product_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "ux_required" boolean DEFAULT true NOT NULL,
  "tech_required" boolean DEFAULT true NOT NULL,
  "user_docs_required" boolean DEFAULT true NOT NULL,
  "arch_docs_required" boolean DEFAULT true NOT NULL,
  "source" text NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "feature_product_revisions_feature_id_idx" ON "feature_product_revisions" ("feature_id");
CREATE UNIQUE INDEX "feature_product_revisions_feature_id_version_key" ON "feature_product_revisions" ("feature_id", "version");

CREATE TABLE "feature_ux_specs" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "head_revision_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "feature_ux_specs_feature_id_key" ON "feature_ux_specs" ("feature_id");

CREATE TABLE "feature_ux_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "feature_ux_revisions_feature_id_idx" ON "feature_ux_revisions" ("feature_id");
CREATE UNIQUE INDEX "feature_ux_revisions_feature_id_version_key" ON "feature_ux_revisions" ("feature_id", "version");

CREATE TABLE "feature_tech_specs" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "head_revision_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "feature_tech_specs_feature_id_key" ON "feature_tech_specs" ("feature_id");

CREATE TABLE "feature_tech_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "feature_tech_revisions_feature_id_idx" ON "feature_tech_revisions" ("feature_id");
CREATE UNIQUE INDEX "feature_tech_revisions_feature_id_version_key" ON "feature_tech_revisions" ("feature_id", "version");

CREATE TABLE "feature_user_doc_specs" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "head_revision_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "feature_user_doc_specs_feature_id_key" ON "feature_user_doc_specs" ("feature_id");

CREATE TABLE "feature_user_doc_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "feature_user_doc_revisions_feature_id_idx" ON "feature_user_doc_revisions" ("feature_id");
CREATE UNIQUE INDEX "feature_user_doc_revisions_feature_id_version_key" ON "feature_user_doc_revisions" ("feature_id", "version");

CREATE TABLE "feature_arch_doc_specs" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "head_revision_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "feature_arch_doc_specs_feature_id_key" ON "feature_arch_doc_specs" ("feature_id");

CREATE TABLE "feature_arch_doc_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "feature_cases"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "markdown" text NOT NULL,
  "source" text NOT NULL,
  "created_by_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "feature_arch_doc_revisions_feature_id_idx" ON "feature_arch_doc_revisions" ("feature_id");
CREATE UNIQUE INDEX "feature_arch_doc_revisions_feature_id_version_key" ON "feature_arch_doc_revisions" ("feature_id", "version");

ALTER TABLE "artifact_approvals" DROP CONSTRAINT IF EXISTS "artifact_approvals_artifact_type_check";
ALTER TABLE "artifact_approvals"
  ADD CONSTRAINT "artifact_approvals_artifact_type_check"
  CHECK ("artifact_type" in (
    'blueprint_ux',
    'blueprint_tech',
    'milestone_design_doc',
    'feature_product_revision',
    'feature_ux_revision',
    'feature_tech_revision',
    'feature_user_doc_revision',
    'feature_arch_doc_revision'
  ));
