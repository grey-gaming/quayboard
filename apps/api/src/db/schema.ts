import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const projectStateValues = [
  "EMPTY",
  "BOOTSTRAPPING",
  "IMPORTING_A",
  "IMPORTING_B",
  "READY_PARTIAL",
  "READY",
] as const;

const jobStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

const secretTypeValues = ["github_pat", "llm_api_key", "oauth_token"] as const;

const settingScopeValues = ["system", "user", "org", "project"] as const;

const now = () => sql`now()`;

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_key").on(table.email),
  }),
);

export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("sessions_token_hash_key").on(table.tokenHash),
    userIndex: index("sessions_user_id_idx").on(table.userId),
    expiresIndex: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const projectsTable = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    state: text("state").notNull().$type<(typeof projectStateValues)[number]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    ownerIndex: index("projects_owner_user_id_idx").on(table.ownerUserId),
    stateCheck: check(
      "projects_state_check",
      sql`${table.state} in (${sql.join(projectStateValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const projectCountersTable = pgTable("project_counters", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  featureCounter: integer("feature_counter").notNull().default(0),
  taskCounter: integer("task_counter").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(now()),
});

export const reposTable = pgTable(
  "repos",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    owner: text("owner"),
    name: text("name"),
    repoUrl: text("repo_url"),
    defaultBranch: text("default_branch"),
    lastSeenSha: text("last_seen_sha"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("repos_project_id_idx").on(table.projectId),
  }),
);

export const jobsTable = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projectsTable.id, {
      onDelete: "cascade",
    }),
    createdByUserId: text("created_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    parentJobId: text("parent_job_id"),
    dependencyJobId: text("dependency_job_id"),
    type: text("type").notNull(),
    status: text("status").notNull().$type<(typeof jobStatusValues)[number]>(),
    inputs: jsonb("inputs").notNull().default(sql`'{}'::jsonb`),
    outputs: jsonb("outputs"),
    error: jsonb("error"),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .default(now()),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    projectIndex: index("jobs_project_id_idx").on(table.projectId),
    statusIndex: index("jobs_status_idx").on(table.status),
    statusCheck: check(
      "jobs_status_check",
      sql`${table.status} in (${sql.join(jobStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const llmRunsTable = pgTable(
  "llm_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projectsTable.id, {
      onDelete: "cascade",
    }),
    jobId: text("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    templateId: text("template_id").notNull(),
    parameters: jsonb("parameters").notNull().default(sql`'{}'::jsonb`),
    input: jsonb("input"),
    output: jsonb("output"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("llm_runs_project_id_idx").on(table.projectId),
    jobIndex: index("llm_runs_job_id_idx").on(table.jobId),
  }),
);

export const settingsTable = pgTable(
  "settings",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull().$type<(typeof settingScopeValues)[number]>(),
    scopeId: text("scope_id"),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    scopeKeyUnique: uniqueIndex("settings_scope_scope_id_key_key").on(
      table.scope,
      table.scopeId,
      table.key,
    ),
    scopeCheck: check(
      "settings_scope_check",
      sql`${table.scope} in (${sql.join(settingScopeValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const encryptedSecretsTable = pgTable(
  "encrypted_secrets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<(typeof secretTypeValues)[number]>(),
    maskedIdentifier: text("masked_identifier").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (table) => ({
    projectIndex: index("encrypted_secrets_project_id_idx").on(table.projectId),
    projectTypeUnique: uniqueIndex("encrypted_secrets_project_id_type_key").on(
      table.projectId,
      table.type,
    ),
    typeCheck: check(
      "encrypted_secrets_type_check",
      sql`${table.type} in (${sql.join(secretTypeValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export type DatabaseSchema = {
  encryptedSecretsTable: typeof encryptedSecretsTable;
  jobsTable: typeof jobsTable;
  llmRunsTable: typeof llmRunsTable;
  projectCountersTable: typeof projectCountersTable;
  projectsTable: typeof projectsTable;
  reposTable: typeof reposTable;
  sessionsTable: typeof sessionsTable;
  settingsTable: typeof settingsTable;
  usersTable: typeof usersTable;
};
