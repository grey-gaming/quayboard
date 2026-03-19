CREATE TABLE "product_specs" (
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

CREATE INDEX "product_specs_project_id_idx" ON "product_specs" USING btree ("project_id");
CREATE UNIQUE INDEX "product_specs_project_id_version_key" ON "product_specs" USING btree ("project_id", "version");
