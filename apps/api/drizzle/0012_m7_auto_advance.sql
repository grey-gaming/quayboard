-- Migration: M7 Auto-Advance Sessions
-- Adds the auto_advance_sessions table for project-scoped orchestration sessions

CREATE TABLE auto_advance_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'paused', 'completed', 'failed')),
  current_step TEXT,
  paused_reason TEXT CHECK (paused_reason IN ('quality_gate_blocker', 'job_failed', 'policy_mismatch', 'manual_pause', 'budget_exceeded', 'needs_human')),
  auto_approve_when_clear BOOLEAN NOT NULL DEFAULT FALSE,
  skip_review_steps BOOLEAN NOT NULL DEFAULT FALSE,
  creativity_mode TEXT NOT NULL DEFAULT 'balanced',
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auto_advance_sessions_project_id_idx ON auto_advance_sessions(project_id);
CREATE UNIQUE INDEX auto_advance_sessions_project_id_key ON auto_advance_sessions(project_id);
