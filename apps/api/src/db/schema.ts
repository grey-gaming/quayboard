import {
  boolean,
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
const blueprintKindValues = ["ux", "tech"] as const;
const artifactTypeValues = [
  "blueprint_ux",
  "blueprint_tech",
  "milestone_design_doc",
] as const;
const milestoneStatusValues = ["draft", "approved", "completed"] as const;
const featureStatusValues = [
  "draft",
  "approved",
  "in_progress",
  "completed",
  "archived",
] as const;
const featureKindValues = [
  "screen",
  "menu",
  "dialog",
  "system",
  "service",
  "library",
  "pipeline",
  "placeholder_visual",
  "placeholder_non_visual",
] as const;
const priorityValues = ["must_have", "should_have", "could_have", "wont_have"] as const;
const featureEdgeTypeValues = ["depends_on", "leads_to", "contains"] as const;

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
    onePagerApprovedAt: timestamp("one_pager_approved_at", { withTimezone: true }),
    userFlowsApprovedAt: timestamp("user_flows_approved_at", {
      withTimezone: true,
    }),
    userFlowsApprovalSnapshot: jsonb("user_flows_approval_snapshot"),
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
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
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

export const questionnaireAnswersTable = pgTable("questionnaire_answers", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  answers: jsonb("answers").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(now()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const onePagersTable = pgTable(
  "one_pagers",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("one_pagers_project_id_idx").on(table.projectId),
    projectVersionUnique: uniqueIndex("one_pagers_project_id_version_key").on(
      table.projectId,
      table.version,
    ),
  }),
);

export const productSpecsTable = pgTable(
  "product_specs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("product_specs_project_id_idx").on(table.projectId),
    projectVersionUnique: uniqueIndex("product_specs_project_id_version_key").on(
      table.projectId,
      table.version,
    ),
  }),
);

export const questionsTable = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
    prompt: text("prompt").notNull(),
    answer: text("answer"),
    placementHint: text("placement_hint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    projectIndex: index("questions_project_id_idx").on(table.projectId),
  }),
);

export const useCasesTable = pgTable(
  "use_cases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    userStory: text("user_story").notNull(),
    entryPoint: text("entry_point").notNull(),
    endState: text("end_state").notNull(),
    flowSteps: jsonb("flow_steps").notNull().default(sql`'[]'::jsonb`),
    coverageTags: jsonb("coverage_tags").notNull().default(sql`'[]'::jsonb`),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .notNull()
      .default(sql`'[]'::jsonb`),
    doneCriteriaRefs: jsonb("done_criteria_refs")
      .notNull()
      .default(sql`'[]'::jsonb`),
    source: text("source").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("use_cases_project_id_idx").on(table.projectId),
  }),
);

export const decisionCardsTable = pgTable(
  "decision_cards",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<(typeof blueprintKindValues)[number]>(),
    key: text("key").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    recommendation: jsonb("recommendation").notNull(),
    alternatives: jsonb("alternatives").notNull().default(sql`'[]'::jsonb`),
    selectedOptionId: text("selected_option_id"),
    customSelection: text("custom_selection"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("decision_cards_project_id_idx").on(table.projectId),
    projectKindIndex: index("decision_cards_project_id_kind_idx").on(table.projectId, table.kind),
    projectKindKeyUnique: uniqueIndex("decision_cards_project_id_kind_key").on(
      table.projectId,
      table.kind,
      table.key,
    ),
    kindCheck: check(
      "decision_cards_kind_check",
      sql`${table.kind} in (${sql.join(blueprintKindValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const projectBlueprintsTable = pgTable(
  "project_blueprints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<(typeof blueprintKindValues)[number]>(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("project_blueprints_project_id_idx").on(table.projectId),
    projectKindIndex: index("project_blueprints_project_id_kind_idx").on(table.projectId, table.kind),
    projectKindVersionUnique: uniqueIndex("project_blueprints_project_id_kind_version_key").on(
      table.projectId,
      table.kind,
      table.version,
    ),
    kindCheck: check(
      "project_blueprints_kind_check",
      sql`${table.kind} in (${sql.join(blueprintKindValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const milestonesTable = pgTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull().$type<(typeof milestoneStatusValues)[number]>(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("milestones_project_id_idx").on(table.projectId),
    projectPositionUnique: uniqueIndex("milestones_project_id_position_key").on(
      table.projectId,
      table.position,
    ),
    statusCheck: check(
      "milestones_status_check",
      sql`${table.status} in (${sql.join(milestoneStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const milestoneUseCasesTable = pgTable(
  "milestone_use_cases",
  {
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestonesTable.id, { onDelete: "cascade" }),
    useCaseId: text("use_case_id")
      .notNull()
      .references(() => useCasesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    milestoneIndex: index("milestone_use_cases_milestone_id_idx").on(table.milestoneId),
    useCaseIndex: index("milestone_use_cases_use_case_id_idx").on(table.useCaseId),
    milestoneUseCaseUnique: uniqueIndex("milestone_use_cases_milestone_id_use_case_id_key").on(
      table.milestoneId,
      table.useCaseId,
    ),
  }),
);

export const milestoneDesignDocsTable = pgTable(
  "milestone_design_docs",
  {
    id: text("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestonesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    milestoneIndex: index("milestone_design_docs_milestone_id_idx").on(table.milestoneId),
    milestoneVersionUnique: uniqueIndex(
      "milestone_design_docs_milestone_id_version_key",
    ).on(table.milestoneId, table.version),
  }),
);

export const featureCasesTable = pgTable(
  "feature_cases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestonesTable.id, { onDelete: "restrict" }),
    featureKey: text("feature_key").notNull(),
    kind: text("kind").notNull().$type<(typeof featureKindValues)[number]>(),
    priority: text("priority").notNull().$type<(typeof priorityValues)[number]>(),
    status: text("status").notNull().$type<(typeof featureStatusValues)[number]>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("feature_cases_project_id_idx").on(table.projectId),
    milestoneIndex: index("feature_cases_milestone_id_idx").on(table.milestoneId),
    projectFeatureKeyUnique: uniqueIndex("feature_cases_project_id_feature_key_key").on(
      table.projectId,
      table.featureKey,
    ),
    statusCheck: check(
      "feature_cases_status_check",
      sql`${table.status} in (${sql.join(featureStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    kindCheck: check(
      "feature_cases_kind_check",
      sql`${table.kind} in (${sql.join(featureKindValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    priorityCheck: check(
      "feature_cases_priority_check",
      sql`${table.priority} in (${sql.join(priorityValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const featureRevisionsTable = pgTable(
  "feature_revisions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .notNull()
      .default(sql`'[]'::jsonb`),
    source: text("source").notNull(),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_revisions_feature_id_idx").on(table.featureId),
    featureVersionUnique: uniqueIndex("feature_revisions_feature_id_version_key").on(
      table.featureId,
      table.version,
    ),
  }),
);

export const featureDependenciesTable = pgTable(
  "feature_dependencies",
  {
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    dependsOnFeatureId: text("depends_on_feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_dependencies_feature_id_idx").on(table.featureId),
    dependsOnIndex: index("feature_dependencies_depends_on_feature_id_idx").on(
      table.dependsOnFeatureId,
    ),
    dependencyUnique: uniqueIndex("feature_dependencies_feature_id_depends_on_feature_id_key").on(
      table.featureId,
      table.dependsOnFeatureId,
    ),
    selfCheck: check(
      "feature_dependencies_self_check",
      sql`${table.featureId} <> ${table.dependsOnFeatureId}`,
    ),
  }),
);

export const featureEdgesTable = pgTable(
  "feature_edges",
  {
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    relatedFeatureId: text("related_feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    edgeType: text("edge_type").notNull().$type<(typeof featureEdgeTypeValues)[number]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_edges_feature_id_idx").on(table.featureId),
    relatedFeatureIndex: index("feature_edges_related_feature_id_idx").on(table.relatedFeatureId),
    edgeUnique: uniqueIndex("feature_edges_feature_id_related_feature_id_edge_type_key").on(
      table.featureId,
      table.relatedFeatureId,
      table.edgeType,
    ),
    edgeTypeCheck: check(
      "feature_edges_edge_type_check",
      sql`${table.edgeType} in (${sql.join(featureEdgeTypeValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    selfCheck: check(
      "feature_edges_self_check",
      sql`${table.featureId} <> ${table.relatedFeatureId}`,
    ),
  }),
);

export const artifactApprovalsTable = pgTable(
  "artifact_approvals",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull().$type<(typeof artifactTypeValues)[number]>(),
    artifactId: text("artifact_id").notNull(),
    approvedByUserId: text("approved_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    artifactIndex: index("artifact_approvals_artifact_idx").on(
      table.projectId,
      table.artifactType,
      table.artifactId,
    ),
    artifactTypeCheck: check(
      "artifact_approvals_artifact_type_check",
      sql`${table.artifactType} in (${sql.join(artifactTypeValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    approverUnique: uniqueIndex("artifact_approvals_artifact_id_approved_by_user_id_key").on(
      table.artifactId,
      table.approvedByUserId,
    ),
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
  featureCasesTable: typeof featureCasesTable;
  featureDependenciesTable: typeof featureDependenciesTable;
  featureEdgesTable: typeof featureEdgesTable;
  featureRevisionsTable: typeof featureRevisionsTable;
  jobsTable: typeof jobsTable;
  llmRunsTable: typeof llmRunsTable;
  milestoneDesignDocsTable: typeof milestoneDesignDocsTable;
  milestoneUseCasesTable: typeof milestoneUseCasesTable;
  milestonesTable: typeof milestonesTable;
  onePagersTable: typeof onePagersTable;
  projectCountersTable: typeof projectCountersTable;
  projectsTable: typeof projectsTable;
  questionnaireAnswersTable: typeof questionnaireAnswersTable;
  questionsTable: typeof questionsTable;
  reposTable: typeof reposTable;
  sessionsTable: typeof sessionsTable;
  settingsTable: typeof settingsTable;
  useCasesTable: typeof useCasesTable;
  usersTable: typeof usersTable;
};
