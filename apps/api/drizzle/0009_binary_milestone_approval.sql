UPDATE "milestones"
SET
  "status" = 'approved',
  "completed_at" = NULL,
  "updated_at" = now()
WHERE "status" = 'completed';

ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_status_check";
ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_status_check"
  CHECK ("status" in ('draft', 'approved'));
