CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text,
  "state" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projects_state_check" CHECK ("state" IN ('EMPTY', 'BOOTSTRAPPING', 'IMPORTING_A', 'IMPORTING_B', 'READY_PARTIAL', 'READY'))
);
--> statement-breakpoint
CREATE INDEX "projects_owner_user_id_idx" ON "projects" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE TABLE "project_counters" (
  "project_id" text PRIMARY KEY NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "feature_counter" integer DEFAULT 0 NOT NULL,
  "task_counter" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "owner" text,
  "name" text,
  "repo_url" text,
  "default_branch" text,
  "last_seen_sha" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "repos_project_id_idx" ON "repos" USING btree ("project_id");
--> statement-breakpoint
CREATE TABLE "jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text REFERENCES "projects"("id") ON DELETE cascade,
  "created_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "parent_job_id" text,
  "dependency_job_id" text,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "outputs" jsonb,
  "error" jsonb,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  CONSTRAINT "jobs_status_check" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX "jobs_project_id_idx" ON "jobs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "llm_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text REFERENCES "projects"("id") ON DELETE cascade,
  "job_id" text REFERENCES "jobs"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "template_id" text NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "llm_runs_project_id_idx" ON "llm_runs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "llm_runs_job_id_idx" ON "llm_runs" USING btree ("job_id");
--> statement-breakpoint
CREATE TABLE "settings" (
  "id" text PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "scope_id" text,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "settings_scope_check" CHECK ("scope" IN ('system', 'user', 'org', 'project'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "settings_scope_scope_id_key_key" ON "settings" USING btree ("scope", "scope_id", "key");
--> statement-breakpoint
CREATE TABLE "encrypted_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "masked_identifier" text NOT NULL,
  "encrypted_value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone,
  CONSTRAINT "encrypted_secrets_type_check" CHECK ("type" IN ('github_pat', 'llm_api_key', 'oauth_token'))
);
--> statement-breakpoint
CREATE INDEX "encrypted_secrets_project_id_idx" ON "encrypted_secrets" USING btree ("project_id");
