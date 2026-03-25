ALTER TABLE "auto_advance_sessions" ADD COLUMN "max_concurrent_jobs" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "auto_advance_sessions" ADD COLUMN "pending_job_count" integer NOT NULL DEFAULT 0;
