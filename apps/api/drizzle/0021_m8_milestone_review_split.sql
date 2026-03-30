ALTER TABLE "projects"
  ADD COLUMN "milestone_map_generated_at" timestamptz,
  ADD COLUMN "milestone_map_review_status" text NOT NULL DEFAULT 'not_started',
  ADD COLUMN "milestone_map_review_issues" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "milestone_map_reviewed_at" timestamptz,
  ADD COLUMN "milestone_map_review_last_job_id" text REFERENCES "jobs"("id") ON DELETE set null;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_milestone_map_review_status_check"
  CHECK ("milestone_map_review_status" in ('not_started', 'passed', 'failed_first_pass', 'failed_needs_human'));

ALTER TABLE "milestones"
  ADD COLUMN "is_bootstrap_placeholder" boolean NOT NULL DEFAULT false,
  ADD COLUMN "scope_review_status" text NOT NULL DEFAULT 'not_started',
  ADD COLUMN "scope_review_issues" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "scope_reviewed_at" timestamptz,
  ADD COLUMN "scope_review_last_job_id" text REFERENCES "jobs"("id") ON DELETE set null,
  ADD COLUMN "delivery_review_status" text NOT NULL DEFAULT 'not_started',
  ADD COLUMN "delivery_review_issues" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "delivery_reviewed_at" timestamptz,
  ADD COLUMN "delivery_review_last_job_id" text REFERENCES "jobs"("id") ON DELETE set null;

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_scope_review_status_check"
  CHECK ("scope_review_status" in ('not_started', 'passed', 'failed_first_pass', 'failed_needs_human'));

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_delivery_review_status_check"
  CHECK ("delivery_review_status" in ('not_started', 'passed', 'failed_first_pass', 'failed_needs_human'));

UPDATE "milestones"
SET
  "scope_review_status" = "reconciliation_status",
  "scope_review_issues" = "reconciliation_issues",
  "scope_reviewed_at" = "reconciliation_reviewed_at",
  "scope_review_last_job_id" = "reconciliation_last_job_id";

UPDATE "milestones"
SET
  "delivery_review_status" = CASE
    WHEN "status" = 'completed' AND "reconciliation_status" = 'passed' THEN 'passed'
    ELSE 'not_started'
  END,
  "delivery_review_issues" = '[]'::jsonb,
  "delivery_reviewed_at" = CASE
    WHEN "status" = 'completed' AND "reconciliation_status" = 'passed'
      THEN COALESCE("reconciliation_reviewed_at", "completed_at")
    ELSE null
  END,
  "delivery_review_last_job_id" = CASE
    WHEN "status" = 'completed' AND "reconciliation_status" = 'passed'
      THEN "reconciliation_last_job_id"
    ELSE null
  END;

UPDATE "milestones" m
SET "is_bootstrap_placeholder" = true
WHERE
  m."position" = 1
  AND m."status" = 'draft'
  AND m."title" = 'Repository and Toolchain Foundations'
  AND m."summary" = 'Establish project README.md, AGENTS.md, ADR documentation, basic scaffolding, hello world page, and tests. Ensures all basics are in place prior to feature development.'
  AND (SELECT count(*) FROM "milestones" m2 WHERE m2."project_id" = m."project_id") = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "milestone_design_docs" d
    WHERE d."milestone_id" = m."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "feature_cases" f
    WHERE f."milestone_id" = m."id"
      AND f."archived_at" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "jobs" j
    WHERE j."project_id" = m."project_id"
      AND j."type" = 'GenerateMilestones'
      AND j."status" = 'succeeded'
  );

UPDATE "projects" p
SET
  "milestone_map_generated_at" = COALESCE(
    (
      SELECT min(COALESCE(j."completed_at", j."started_at", j."queued_at"))
      FROM "jobs" j
      WHERE j."project_id" = p."id"
        AND j."type" = 'GenerateMilestones'
        AND j."status" = 'succeeded'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM "milestones" m
        WHERE m."project_id" = p."id"
          AND m."is_bootstrap_placeholder" = false
      )
      THEN p."updated_at"
      ELSE null
    END
  ),
  "milestone_map_review_status" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "milestones" m
      WHERE m."project_id" = p."id"
        AND m."status" IN ('approved', 'completed')
    )
    OR EXISTS (
      SELECT 1
      FROM "feature_cases" f
      WHERE f."project_id" = p."id"
        AND f."archived_at" IS NULL
    )
    THEN 'passed'
    ELSE 'not_started'
  END,
  "milestone_map_review_issues" = '[]'::jsonb,
  "milestone_map_reviewed_at" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "milestones" m
      WHERE m."project_id" = p."id"
        AND m."status" IN ('approved', 'completed')
    )
    OR EXISTS (
      SELECT 1
      FROM "feature_cases" f
      WHERE f."project_id" = p."id"
        AND f."archived_at" IS NULL
    )
    THEN p."updated_at"
    ELSE null
  END,
  "milestone_map_review_last_job_id" = (
    SELECT j."id"
    FROM "jobs" j
    WHERE j."project_id" = p."id"
      AND j."type" = 'GenerateMilestones'
      AND j."status" = 'succeeded'
    ORDER BY COALESCE(j."completed_at", j."started_at", j."queued_at") DESC
    LIMIT 1
  );
