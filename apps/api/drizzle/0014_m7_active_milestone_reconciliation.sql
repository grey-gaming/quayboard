-- Migration: M7 Active Milestone Reconciliation
-- Extends milestone lifecycle and stores milestone-level reconciliation state.

ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_status_check;

ALTER TABLE milestones
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN reconciliation_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN reconciliation_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN reconciliation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN reconciliation_last_job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  ADD COLUMN auto_catch_up_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE milestones
  ADD CONSTRAINT milestones_status_check
  CHECK (status IN ('draft', 'approved', 'completed'));

ALTER TABLE milestones
  ADD CONSTRAINT milestones_reconciliation_status_check
  CHECK (
    reconciliation_status IN (
      'not_started',
      'passed',
      'failed_first_pass',
      'failed_needs_human'
    )
  );
