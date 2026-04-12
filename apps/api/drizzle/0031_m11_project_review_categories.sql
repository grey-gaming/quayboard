ALTER TABLE "project_review_findings" DROP CONSTRAINT IF EXISTS "project_review_findings_category_check";
ALTER TABLE "project_review_findings"
  ADD CONSTRAINT "project_review_findings_category_check"
  CHECK ("category" in ('documentation', 'tests', 'completeness', 'architecture', 'code_quality', 'security'));
