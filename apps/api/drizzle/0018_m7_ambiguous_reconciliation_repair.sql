ALTER TABLE auto_advance_sessions
  ADD COLUMN IF NOT EXISTS auto_resolve_ambiguous_reconciliation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambiguous_reconciliation_repair_count INTEGER NOT NULL DEFAULT 0;
