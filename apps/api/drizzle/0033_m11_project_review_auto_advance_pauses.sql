-- Adds explicit auto-advance pause reasons for project-review retry exhaustion
-- and incomplete project-review remediation branches.

ALTER TABLE auto_advance_sessions
  DROP CONSTRAINT auto_advance_sessions_paused_reason_check;

ALTER TABLE auto_advance_sessions
  ADD CONSTRAINT auto_advance_sessions_paused_reason_check CHECK (
    paused_reason IS NULL OR paused_reason IN (
      'quality_gate_blocker',
      'job_failed',
      'policy_mismatch',
      'manual_pause',
      'budget_exceeded',
      'needs_human',
      'milestone_map_repair_limit_reached',
      'milestone_repair_limit_reached',
      'review_limit_reached',
      'ci_fix_budget_exceeded',
      'ci_wait_limit_reached',
      'project_review_limit_reached',
      'project_review_retry_limit_reached',
      'project_review_incomplete'
    )
  );
