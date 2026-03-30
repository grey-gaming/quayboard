ALTER TABLE auto_advance_sessions
  ADD COLUMN IF NOT EXISTS batch_failure_count INTEGER NOT NULL DEFAULT 0;
