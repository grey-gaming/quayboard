-- Migration: M6 Task Planning
-- Adds tables for task planning sessions, clarifications, delivery tasks, task issues, and implementation records

-- Task planning sessions (one per feature with approved tech spec)
CREATE TABLE feature_task_planning_sessions (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES feature_cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending_clarifications', 'clarifications_generated', 'clarifications_answered', 'tasks_generated')),
  created_by_job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feature_task_planning_sessions_feature_id_idx ON feature_task_planning_sessions(feature_id);
CREATE UNIQUE INDEX feature_task_planning_sessions_feature_id_key ON feature_task_planning_sessions(feature_id);

-- Clarification questions for task planning
CREATE TABLE feature_task_clarifications (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES feature_task_planning_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped')),
  answer TEXT,
  answer_source TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feature_task_clarifications_session_id_idx ON feature_task_clarifications(session_id);
CREATE UNIQUE INDEX feature_task_clarifications_session_id_position_key ON feature_task_clarifications(session_id, position);

-- Delivery tasks generated from clarifications
CREATE TABLE feature_delivery_tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES feature_task_planning_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  created_by_job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feature_delivery_tasks_session_id_idx ON feature_delivery_tasks(session_id);
CREATE UNIQUE INDEX feature_delivery_tasks_session_id_position_key ON feature_delivery_tasks(session_id, position);

-- Issues discovered during task implementation
CREATE TABLE feature_task_issues (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES feature_delivery_tasks(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('blocker', 'warning', 'suggestion')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feature_task_issues_task_id_idx ON feature_task_issues(task_id);

-- Implementation records tracking which tech revision was implemented
CREATE TABLE implementation_records (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES feature_cases(id) ON DELETE CASCADE,
  tech_revision_id TEXT NOT NULL REFERENCES feature_tech_revisions(id) ON DELETE RESTRICT,
  commit_sha TEXT,
  sandbox_run_id TEXT,
  implemented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX implementation_records_feature_id_idx ON implementation_records(feature_id);
CREATE INDEX implementation_records_tech_revision_id_idx ON implementation_records(tech_revision_id);
CREATE UNIQUE INDEX implementation_records_feature_id_tech_revision_id_key ON implementation_records(feature_id, tech_revision_id);