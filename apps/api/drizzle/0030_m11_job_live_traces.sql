CREATE TABLE "job_trace_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"project_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_trace_events" ADD CONSTRAINT "job_trace_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_trace_events" ADD CONSTRAINT "job_trace_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "job_trace_events_job_id_idx" ON "job_trace_events" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "job_trace_events_project_id_idx" ON "job_trace_events" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "job_trace_events_job_id_sequence_key" ON "job_trace_events" USING btree ("job_id","sequence");
