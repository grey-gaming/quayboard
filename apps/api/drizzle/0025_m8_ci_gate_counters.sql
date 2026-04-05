ALTER TABLE auto_advance_sessions
  ADD COLUMN ci_fix_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN ci_wait_window_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE auto_advance_sessions DROP CONSTRAINT IF EXISTS auto_advance_sessions_paused_reason_check;

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
      'ci_wait_limit_reached'
    )
  );

ALTER TABLE sandbox_runs DROP CONSTRAINT IF EXISTS sandbox_runs_kind_check;

ALTER TABLE sandbox_runs
  ADD CONSTRAINT sandbox_runs_kind_check CHECK (
    kind IN ('implement', 'verify', 'ci_repair')
  );
