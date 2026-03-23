UPDATE "milestones" AS m
SET
  "status" = 'draft',
  "approved_at" = NULL,
  "updated_at" = now()
WHERE m."status" = 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM "milestone_design_docs" AS d
    WHERE d."milestone_id" = m."id"
      AND d."is_canonical" = true
  );
