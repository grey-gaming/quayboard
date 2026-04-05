import {
  type AnyPgColumn,
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
  "feature_product_revision",
  "feature_ux_revision",
  "feature_tech_revision",
  "feature_user_doc_revision",
  "feature_arch_doc_revision",
] as const;
const milestoneStatusValues = ["draft", "approved", "completed"] as const;
const milestoneReconciliationStatusValues = [
  "not_started",
  "passed",
  "failed_first_pass",
  "failed_needs_human",
] as const;
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
const contextPackTypeValues = ["planning", "coding"] as const;
const sandboxRunKindValues = ["implement", "verify", "ci_repair"] as const;
const sandboxRunStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
const sandboxRunOutcomeValues = [
  "changes_applied",
  "no_op",
  "verification_passed",
  "verification_failed",
  "cancelled",
  "error",
] as const;
const sandboxEventLevelValues = ["info", "warning", "error"] as const;

const now = () => sql`now()`;

const autoAdvanceStatusValues = [
  "idle",
  "running",
  "paused",
  "completed",
  "failed",
] as const;

const autoAdvancePausedReasonValues = [
  "quality_gate_blocker",
  "job_failed",
  "policy_mismatch",
  "manual_pause",
  "budget_exceeded",
  "needs_human",
  "milestone_map_repair_limit_reached",
  "milestone_repair_limit_reached",
  "review_limit_reached",
  "ci_fix_budget_exceeded",
  "ci_wait_limit_reached",
] as const;

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
    milestoneMapGeneratedAt: timestamp("milestone_map_generated_at", {
      withTimezone: true,
    }),
    milestoneMapReviewStatus: text("milestone_map_review_status")
      .notNull()
      .$type<(typeof milestoneReconciliationStatusValues)[number]>()
      .default("not_started"),
    milestoneMapReviewIssues: jsonb("milestone_map_review_issues")
      .notNull()
      .default(sql`'[]'::jsonb`),
    milestoneMapReviewedAt: timestamp("milestone_map_reviewed_at", {
      withTimezone: true,
    }),
    milestoneMapReviewLastJobId: text("milestone_map_review_last_job_id").references(
      (): AnyPgColumn => jobsTable.id,
      { onDelete: "set null" },
    ),
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
    milestoneMapReviewStatusCheck: check(
      "projects_milestone_map_review_status_check",
      sql`${table.milestoneMapReviewStatus} in (${sql.join(milestoneReconciliationStatusValues.map((value) => sql`${value}`), sql`, `)})`,
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
    reconciliationStatus: text("reconciliation_status")
      .notNull()
      .$type<(typeof milestoneReconciliationStatusValues)[number]>()
      .default("not_started"),
    reconciliationIssues: jsonb("reconciliation_issues")
      .notNull()
      .default(sql`'[]'::jsonb`),
    reconciliationReviewedAt: timestamp("reconciliation_reviewed_at", { withTimezone: true }),
    reconciliationLastJobId: text("reconciliation_last_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    scopeReviewStatus: text("scope_review_status")
      .notNull()
      .$type<(typeof milestoneReconciliationStatusValues)[number]>()
      .default("not_started"),
    scopeReviewIssues: jsonb("scope_review_issues")
      .notNull()
      .default(sql`'[]'::jsonb`),
    scopeReviewedAt: timestamp("scope_reviewed_at", { withTimezone: true }),
    scopeReviewLastJobId: text("scope_review_last_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    deliveryReviewStatus: text("delivery_review_status")
      .notNull()
      .$type<(typeof milestoneReconciliationStatusValues)[number]>()
      .default("not_started"),
    deliveryReviewIssues: jsonb("delivery_review_issues")
      .notNull()
      .default(sql`'[]'::jsonb`),
    deliveryReviewedAt: timestamp("delivery_reviewed_at", { withTimezone: true }),
    deliveryReviewLastJobId: text("delivery_review_last_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    autoCatchUpCount: integer("auto_catch_up_count").notNull().default(0),
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
    reconciliationStatusCheck: check(
      "milestones_reconciliation_status_check",
      sql`${table.reconciliationStatus} in (${sql.join(milestoneReconciliationStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    scopeReviewStatusCheck: check(
      "milestones_scope_review_status_check",
      sql`${table.scopeReviewStatus} in (${sql.join(milestoneReconciliationStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    deliveryReviewStatusCheck: check(
      "milestones_delivery_review_status_check",
      sql`${table.deliveryReviewStatus} in (${sql.join(milestoneReconciliationStatusValues.map((value) => sql`${value}`), sql`, `)})`,
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

export const featureProductSpecsTable = pgTable(
  "feature_product_specs",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    headRevisionId: text("head_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureUnique: uniqueIndex("feature_product_specs_feature_id_key").on(table.featureId),
  }),
);

export const featureProductRevisionsTable = pgTable(
  "feature_product_revisions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    uxRequired: boolean("ux_required").notNull().default(true),
    techRequired: boolean("tech_required").notNull().default(true),
    userDocsRequired: boolean("user_docs_required").notNull().default(true),
    archDocsRequired: boolean("arch_docs_required").notNull().default(true),
    source: text("source").notNull(),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_product_revisions_feature_id_idx").on(table.featureId),
    featureVersionUnique: uniqueIndex("feature_product_revisions_feature_id_version_key").on(
      table.featureId,
      table.version,
    ),
  }),
);

export const featureUxSpecsTable = pgTable(
  "feature_ux_specs",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    headRevisionId: text("head_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureUnique: uniqueIndex("feature_ux_specs_feature_id_key").on(table.featureId),
  }),
);

export const featureUxRevisionsTable = pgTable(
  "feature_ux_revisions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_ux_revisions_feature_id_idx").on(table.featureId),
    featureVersionUnique: uniqueIndex("feature_ux_revisions_feature_id_version_key").on(
      table.featureId,
      table.version,
    ),
  }),
);

export const featureTechSpecsTable = pgTable(
  "feature_tech_specs",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    headRevisionId: text("head_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureUnique: uniqueIndex("feature_tech_specs_feature_id_key").on(table.featureId),
  }),
);

export const featureTechRevisionsTable = pgTable(
  "feature_tech_revisions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_tech_revisions_feature_id_idx").on(table.featureId),
    featureVersionUnique: uniqueIndex("feature_tech_revisions_feature_id_version_key").on(
      table.featureId,
      table.version,
    ),
  }),
);

export const featureUserDocSpecsTable = pgTable(
  "feature_user_doc_specs",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    headRevisionId: text("head_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureUnique: uniqueIndex("feature_user_doc_specs_feature_id_key").on(table.featureId),
  }),
);

export const featureUserDocRevisionsTable = pgTable(
  "feature_user_doc_revisions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_user_doc_revisions_feature_id_idx").on(table.featureId),
    featureVersionUnique: uniqueIndex("feature_user_doc_revisions_feature_id_version_key").on(
      table.featureId,
      table.version,
    ),
  }),
);

export const featureArchDocSpecsTable = pgTable(
  "feature_arch_doc_specs",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    headRevisionId: text("head_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureUnique: uniqueIndex("feature_arch_doc_specs_feature_id_key").on(table.featureId),
  }),
);

export const featureArchDocRevisionsTable = pgTable(
  "feature_arch_doc_revisions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    source: text("source").notNull(),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("feature_arch_doc_revisions_feature_id_idx").on(table.featureId),
    featureVersionUnique: uniqueIndex("feature_arch_doc_revisions_feature_id_version_key").on(
      table.featureId,
      table.version,
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

const taskPlanningSessionStatusValues = [
  "pending_clarifications",
  "clarifications_generated",
  "clarifications_answered",
  "tasks_generated",
] as const;

export const featureTaskPlanningSessionsTable = pgTable(
  "feature_task_planning_sessions",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    status: text("status")
      .notNull()
      .$type<(typeof taskPlanningSessionStatusValues)[number]>(),
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
    featureIndex: index(
      "feature_task_planning_sessions_feature_id_idx",
    ).on(table.featureId),
    featureUnique: uniqueIndex(
      "feature_task_planning_sessions_feature_id_key",
    ).on(table.featureId),
    statusCheck: check(
      "feature_task_planning_sessions_status_check",
      sql`${table.status} in (${sql.join(taskPlanningSessionStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

const clarificationStatusValues = ["pending", "answered", "skipped"] as const;

export const featureTaskClarificationsTable = pgTable(
  "feature_task_clarifications",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => featureTaskPlanningSessionsTable.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    question: text("question").notNull(),
    context: text("context"),
    status: text("status")
      .notNull()
      .default("pending")
      .$type<(typeof clarificationStatusValues)[number]>(),
    answer: text("answer"),
    answerSource: text("answer_source"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    sessionIndex: index("feature_task_clarifications_session_id_idx").on(
      table.sessionId,
    ),
    sessionPositionUnique: uniqueIndex(
      "feature_task_clarifications_session_id_position_key",
    ).on(table.sessionId, table.position),
    statusCheck: check(
      "feature_task_clarifications_status_check",
      sql`${table.status} in (${sql.join(clarificationStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

const deliveryTaskStatusValues = ["pending", "in_progress", "completed", "blocked"] as const;

export const featureDeliveryTasksTable = pgTable(
  "feature_delivery_tasks",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => featureTaskPlanningSessionsTable.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions"),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text("status")
      .notNull()
      .default("pending")
      .$type<(typeof deliveryTaskStatusValues)[number]>(),
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
    sessionIndex: index("feature_delivery_tasks_session_id_idx").on(
      table.sessionId,
    ),
    sessionPositionUnique: uniqueIndex(
      "feature_delivery_tasks_session_id_position_key",
    ).on(table.sessionId, table.position),
    statusCheck: check(
      "feature_delivery_tasks_status_check",
      sql`${table.status} in (${sql.join(deliveryTaskStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

const taskIssueSeverityValues = ["blocker", "warning", "suggestion"] as const;
const taskIssueStatusValues = ["open", "resolved", "ignored"] as const;

export const featureTaskIssuesTable = pgTable(
  "feature_task_issues",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => featureDeliveryTasksTable.id, { onDelete: "cascade" }),
    severity: text("severity")
      .notNull()
      .$type<(typeof taskIssueSeverityValues)[number]>(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    status: text("status")
      .notNull()
      .default("open")
      .$type<(typeof taskIssueStatusValues)[number]>(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    taskIndex: index("feature_task_issues_task_id_idx").on(table.taskId),
    statusCheck: check(
      "feature_task_issues_status_check",
      sql`${table.status} in (${sql.join(taskIssueStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    severityCheck: check(
      "feature_task_issues_severity_check",
      sql`${table.severity} in (${sql.join(taskIssueSeverityValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const implementationRecordsTable = pgTable(
  "implementation_records",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    techRevisionId: text("tech_revision_id")
      .notNull()
      .references(() => featureTechRevisionsTable.id, { onDelete: "restrict" }),
    commitSha: text("commit_sha"),
    sandboxRunId: text("sandbox_run_id"),
    implementedAt: timestamp("implemented_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    featureIndex: index("implementation_records_feature_id_idx").on(
      table.featureId,
    ),
    techRevisionIndex: index(
      "implementation_records_tech_revision_id_idx",
    ).on(table.techRevisionId),
    featureTechRevisionUnique: uniqueIndex(
      "implementation_records_feature_id_tech_revision_id_key",
    ).on(table.featureId, table.techRevisionId),
  }),
);

export const logbookVersionsTable = pgTable(
  "logbook_versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    coverageFlags: jsonb("coverage_flags").notNull().default(sql`'{}'::jsonb`),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("logbook_versions_project_id_idx").on(table.projectId),
  }),
);

export const memoryChunksTable = pgTable(
  "memory_chunks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    logbookVersionId: text("logbook_version_id").references(() => logbookVersionsTable.id, {
      onDelete: "set null",
    }),
    key: text("key").notNull(),
    content: text("content").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("memory_chunks_project_id_idx").on(table.projectId),
    projectKeyUnique: uniqueIndex("memory_chunks_project_id_key_key").on(
      table.projectId,
      table.key,
    ),
  }),
);

export const contextPacksTable = pgTable(
  "context_packs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    featureId: text("feature_id").references(() => featureCasesTable.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull().$type<(typeof contextPackTypeValues)[number]>(),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    summary: text("summary").notNull(),
    stale: boolean("stale").notNull().default(false),
    omissionList: jsonb("omission_list").notNull().default(sql`'[]'::jsonb`),
    sourceCoverage: jsonb("source_coverage").notNull().default(sql`'[]'::jsonb`),
    createdByJobId: text("created_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("context_packs_project_id_idx").on(table.projectId),
    featureIndex: index("context_packs_feature_id_idx").on(table.featureId),
    projectFeatureTypeVersionUnique: uniqueIndex(
      "context_packs_project_id_feature_id_type_version_key",
    ).on(table.projectId, table.featureId, table.type, table.version),
    typeCheck: check(
      "context_packs_type_check",
      sql`${table.type} in (${sql.join(contextPackTypeValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const sandboxRunsTable = pgTable(
  "sandbox_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    featureId: text("feature_id").references(() => featureCasesTable.id, {
      onDelete: "cascade",
    }),
    milestoneId: text("milestone_id").references(() => milestonesTable.id, {
      onDelete: "cascade",
    }),
    taskPlanningSessionId: text("task_planning_session_id").references(
      () => featureTaskPlanningSessionsTable.id,
      { onDelete: "set null" },
    ),
    contextPackId: text("context_pack_id").references(() => contextPacksTable.id, {
      onDelete: "set null",
    }),
    triggeredByJobId: text("triggered_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull().$type<(typeof sandboxRunKindValues)[number]>(),
    status: text("status").notNull().$type<(typeof sandboxRunStatusValues)[number]>(),
    outcome: text("outcome").$type<(typeof sandboxRunOutcomeValues)[number]>(),
    containerId: text("container_id"),
    baseCommitSha: text("base_commit_sha"),
    headCommitSha: text("head_commit_sha"),
    branchName: text("branch_name"),
    pullRequestUrl: text("pull_request_url"),
    cancellationReason: text("cancellation_reason"),
    workspaceArchivePath: text("workspace_archive_path"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("sandbox_runs_project_id_idx").on(table.projectId),
    featureIndex: index("sandbox_runs_feature_id_idx").on(table.featureId),
    milestoneIndex: index("sandbox_runs_milestone_id_idx").on(table.milestoneId),
    statusIndex: index("sandbox_runs_status_idx").on(table.status),
    kindCheck: check(
      "sandbox_runs_kind_check",
      sql`${table.kind} in (${sql.join(sandboxRunKindValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    statusCheck: check(
      "sandbox_runs_status_check",
      sql`${table.status} in (${sql.join(sandboxRunStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    outcomeCheck: check(
      "sandbox_runs_outcome_check",
      sql`${table.outcome} is null or ${table.outcome} in (${sql.join(sandboxRunOutcomeValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const sandboxRunEventsTable = pgTable(
  "sandbox_run_events",
  {
    id: text("id").primaryKey(),
    sandboxRunId: text("sandbox_run_id")
      .notNull()
      .references(() => sandboxRunsTable.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    level: text("level").notNull().$type<(typeof sandboxEventLevelValues)[number]>(),
    type: text("type").notNull(),
    message: text("message").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    runIndex: index("sandbox_run_events_run_id_idx").on(table.sandboxRunId),
    runSequenceUnique: uniqueIndex("sandbox_run_events_run_id_sequence_key").on(
      table.sandboxRunId,
      table.sequence,
    ),
    levelCheck: check(
      "sandbox_run_events_level_check",
      sql`${table.level} in (${sql.join(sandboxEventLevelValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const sandboxRunArtifactsTable = pgTable(
  "sandbox_run_artifacts",
  {
    id: text("id").primaryKey(),
    sandboxRunId: text("sandbox_run_id")
      .notNull()
      .references(() => sandboxRunsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    storagePath: text("storage_path").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    runIndex: index("sandbox_run_artifacts_run_id_idx").on(table.sandboxRunId),
    runNameUnique: uniqueIndex("sandbox_run_artifacts_run_id_name_key").on(
      table.sandboxRunId,
      table.name,
    ),
  }),
);

export const sandboxMilestoneSessionsTable = pgTable(
  "sandbox_milestone_sessions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestonesTable.id, { onDelete: "cascade" }),
    triggeredByJobId: text("triggered_by_job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().$type<(typeof sandboxRunStatusValues)[number]>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("sandbox_milestone_sessions_project_id_idx").on(table.projectId),
    milestoneIndex: index("sandbox_milestone_sessions_milestone_id_idx").on(table.milestoneId),
    statusCheck: check(
      "sandbox_milestone_sessions_status_check",
      sql`${table.status} in (${sql.join(sandboxRunStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const sandboxMilestoneSessionTasksTable = pgTable(
  "sandbox_milestone_session_tasks",
  {
    id: text("id").primaryKey(),
    sandboxMilestoneSessionId: text("sandbox_milestone_session_id")
      .notNull()
      .references(() => sandboxMilestoneSessionsTable.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureCasesTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sandboxRunId: text("sandbox_run_id").references(() => sandboxRunsTable.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().$type<(typeof sandboxRunStatusValues)[number]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    sessionIndex: index("sandbox_milestone_session_tasks_session_id_idx").on(
      table.sandboxMilestoneSessionId,
    ),
    sessionPositionUnique: uniqueIndex(
      "sandbox_milestone_session_tasks_session_id_position_key",
    ).on(table.sandboxMilestoneSessionId, table.position),
    statusCheck: check(
      "sandbox_milestone_session_tasks_status_check",
      sql`${table.status} in (${sql.join(sandboxRunStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const autoAdvanceSessionsTable = pgTable(
  "auto_advance_sessions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    status: text("status")
      .notNull()
      .$type<(typeof autoAdvanceStatusValues)[number]>(),
    currentStep: text("current_step"),
    pausedReason: text("paused_reason").$type<
      (typeof autoAdvancePausedReasonValues)[number]
    >(),
    autoApproveWhenClear: boolean("auto_approve_when_clear")
      .notNull()
      .default(false),
    skipReviewSteps: boolean("skip_review_steps").notNull().default(false),
    skipHumanReview: boolean("skip_human_review").notNull().default(false),
    autoRepairMilestoneCoverage: boolean("auto_repair_milestone_coverage")
      .notNull()
      .default(false),
    creativityMode: text("creativity_mode").notNull().default("balanced"),
    retryCount: integer("retry_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    milestoneRepairCount: integer("milestone_repair_count")
      .notNull()
      .default(0),
    ciFixCount: integer("ci_fix_count").notNull().default(0),
    ciWaitWindowCount: integer("ci_wait_window_count").notNull().default(0),
    maxConcurrentJobs: integer("max_concurrent_jobs").notNull().default(1),
    pendingJobCount: integer("pending_job_count").notNull().default(0),
    batchFailureCount: integer("batch_failure_count").notNull().default(0),
    activeBatchToken: text("active_batch_token"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(now()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(now()),
  },
  (table) => ({
    projectIndex: index("auto_advance_sessions_project_id_idx").on(
      table.projectId,
    ),
    projectUnique: uniqueIndex("auto_advance_sessions_project_id_key").on(
      table.projectId,
    ),
    statusCheck: check(
      "auto_advance_sessions_status_check",
      sql`${table.status} in (${sql.join(autoAdvanceStatusValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
    pausedReasonCheck: check(
      "auto_advance_sessions_paused_reason_check",
      sql`${table.pausedReason} is null or ${table.pausedReason} in (${sql.join(autoAdvancePausedReasonValues.map((value) => sql`${value}`), sql`, `)})`,
    ),
  }),
);

export const jobsTable = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references((): AnyPgColumn => projectsTable.id, {
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
  artifactApprovalsTable: typeof artifactApprovalsTable;
  autoAdvanceSessionsTable: typeof autoAdvanceSessionsTable;
  contextPacksTable: typeof contextPacksTable;
  encryptedSecretsTable: typeof encryptedSecretsTable;
  featureArchDocRevisionsTable: typeof featureArchDocRevisionsTable;
  featureArchDocSpecsTable: typeof featureArchDocSpecsTable;
  featureCasesTable: typeof featureCasesTable;
  featureDeliveryTasksTable: typeof featureDeliveryTasksTable;
  featureDependenciesTable: typeof featureDependenciesTable;
  featureEdgesTable: typeof featureEdgesTable;
  featureProductRevisionsTable: typeof featureProductRevisionsTable;
  featureProductSpecsTable: typeof featureProductSpecsTable;
  featureRevisionsTable: typeof featureRevisionsTable;
  featureTaskClarificationsTable: typeof featureTaskClarificationsTable;
  featureTaskIssuesTable: typeof featureTaskIssuesTable;
  featureTaskPlanningSessionsTable: typeof featureTaskPlanningSessionsTable;
  featureTechRevisionsTable: typeof featureTechRevisionsTable;
  featureTechSpecsTable: typeof featureTechSpecsTable;
  featureUserDocRevisionsTable: typeof featureUserDocRevisionsTable;
  featureUserDocSpecsTable: typeof featureUserDocSpecsTable;
  featureUxRevisionsTable: typeof featureUxRevisionsTable;
  featureUxSpecsTable: typeof featureUxSpecsTable;
  implementationRecordsTable: typeof implementationRecordsTable;
  jobsTable: typeof jobsTable;
  llmRunsTable: typeof llmRunsTable;
  logbookVersionsTable: typeof logbookVersionsTable;
  memoryChunksTable: typeof memoryChunksTable;
  milestoneDesignDocsTable: typeof milestoneDesignDocsTable;
  milestoneUseCasesTable: typeof milestoneUseCasesTable;
  milestonesTable: typeof milestonesTable;
  onePagersTable: typeof onePagersTable;
  projectCountersTable: typeof projectCountersTable;
  projectsTable: typeof projectsTable;
  questionnaireAnswersTable: typeof questionnaireAnswersTable;
  questionsTable: typeof questionsTable;
  reposTable: typeof reposTable;
  sandboxMilestoneSessionsTable: typeof sandboxMilestoneSessionsTable;
  sandboxMilestoneSessionTasksTable: typeof sandboxMilestoneSessionTasksTable;
  sandboxRunArtifactsTable: typeof sandboxRunArtifactsTable;
  sandboxRunEventsTable: typeof sandboxRunEventsTable;
  sandboxRunsTable: typeof sandboxRunsTable;
  sessionsTable: typeof sessionsTable;
  settingsTable: typeof settingsTable;
  useCasesTable: typeof useCasesTable;
  usersTable: typeof usersTable;
};
