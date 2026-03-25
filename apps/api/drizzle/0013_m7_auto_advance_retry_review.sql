-- Migration: M7 Auto-Advance Retry and Review Pass
-- Adds retry_count and review_count to auto_advance_sessions,
-- and extends the paused_reason check constraint with review_limit_reached.

ALTER TABLE auto_advance_sessions
  ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;

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
      'review_limit_reached'
    )
  );
