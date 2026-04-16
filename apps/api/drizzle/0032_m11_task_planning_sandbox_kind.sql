ALTER TABLE "sandbox_runs" DROP CONSTRAINT IF EXISTS "sandbox_runs_kind_check";

ALTER TABLE "sandbox_runs"
  ADD CONSTRAINT "sandbox_runs_kind_check"
  CHECK ("kind" in ('implement', 'verify', 'ci_repair', 'project_review', 'project_fix', 'bug_fix', 'task_planning'));
