ALTER TABLE auto_advance_sessions
  RENAME COLUMN auto_resolve_ambiguous_reconciliation TO auto_repair_milestone_coverage;

ALTER TABLE auto_advance_sessions
  RENAME COLUMN ambiguous_reconciliation_repair_count TO milestone_repair_count;

ALTER TABLE auto_advance_sessions DROP CONSTRAINT IF EXISTS auto_advance_sessions_paused_reason_check;

ALTER TABLE auto_advance_sessions
  ADD CONSTRAINT auto_advance_sessions_paused_reason_check
  CHECK (
    paused_reason IS NULL OR paused_reason IN (
      'quality_gate_blocker',
      'job_failed',
      'policy_mismatch',
      'manual_pause',
      'budget_exceeded',
      'needs_human',
      'milestone_repair_limit_reached',
      'review_limit_reached'
    )
  );
