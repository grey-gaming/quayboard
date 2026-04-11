import { and, eq, isNull } from "drizzle-orm";

import {
  createFeatureRevisionRequestSchema,
  createFeatureProductRevisionRequestSchema,
  createFeatureWorkstreamRevisionRequestSchema,
  featureKindSchema,
  prioritySchema,
  questionnaireAnswerMapSchema,
  questionnaireDefinition,
} from "@quayboard/shared";
import type { FeatureKind, Priority } from "@quayboard/shared";

import type { AppDatabase } from "../../db/client.js";
import {
  autoAdvanceSessionsTable,
  llmRunsTable,
  milestoneUseCasesTable,
  milestonesTable,
  projectReviewSessionsTable,
  useCasesTable,
} from "../../db/schema.js";
import type { ArtifactApprovalService } from "../artifact-approval-service.js";
import type { BugService } from "../bug-service.js";
import type { BlueprintService } from "../blueprint-service.js";
import type { ContextPackService } from "../context-pack-service.js";
import type { FeatureService } from "../feature-service.js";
import type { FeatureWorkstreamService } from "../feature-workstream-service.js";
import { generateId } from "../ids.js";
import type { LlmProviderError, LlmProviderService } from "../llm-provider.js";
import type { MilestoneService } from "../milestone-service.js";
import type { OnePagerService } from "../one-pager-service.js";
import type { ProductSpecService } from "../product-spec-service.js";
import type { ProjectService } from "../project-service.js";
import type { ProjectReviewService } from "../project-review-service.js";
import type { ProjectSetupService } from "../project-setup-service.js";
import type { QuestionnaireService } from "../questionnaire-service.js";
import type { SandboxService } from "../sandbox-service.js";
import type { JobTraceService } from "../job-trace-service.js";
import type { UserFlowService } from "../user-flow-service.js";
import { classifyProjectSize } from "../project-sizer.js";
import { createTaskPlanningService } from "../task-planning-service.js";
import {
  buildTaskPlanningDocuments,
  buildTaskPlanningReadinessMessage,
  isTaskPlanningReady,
} from "../task-planning-support.js";
import {
  buildFeatureProductSpecReviewPrompt,
  buildFeatureTaskListReviewPrompt,
  buildFeatureWorkstreamReviewPrompt,
  buildDecisionConsistencyPrompt,
  buildDecisionSelectionRepairPrompt,
  buildDecisionSelectionRepairReviewPrompt,
  buildDecisionDeckPrompt,
  buildDeliveryReviewPrompt,
  buildFeatureArchDocsPrompt,
  buildFeatureProductSpecPrompt,
  buildFeatureTechSpecPrompt,
  buildFeatureUserDocsPrompt,
  buildFeatureUxSpecPrompt,
  buildMilestoneDesignPrompt,
  buildMilestoneDesignRepairPrompt,
  buildMilestoneCoverageReviewPrompt,
  buildMilestoneCoverageRepairPrompt,
  buildMilestoneCoverageRepairReviewPrompt,
  buildMilestoneFeatureSetPrompt,
  buildMilestoneFeatureSetReviewPrompt,
  buildMilestonePlanPrompt,
  buildProjectBlueprintPrompt,
  buildQuestionnaireAutoAnswerPrompt,
  buildRewriteMilestoneFeatureSetPrompt,
  buildRewriteMilestoneFeatureSetReviewPrompt,
  buildProjectOverviewPrompt,
  buildProductSpecPrompt,
  buildProductSpecQualityCheckPrompt,
  buildProductSpecReviewPrompt,
  buildUserFlowPrompt,
  buildTaskClarificationsPrompt,
  buildAutoAnswerClarificationsPrompt,
  buildAppendMilestonePlanPrompt,
  buildFeatureTaskListPrompt,
} from "./job-prompts.js";
import type { JobService } from "./job-service.js";

const unwrapJsonFence = (value: string) => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fencedMatch?.[1]?.trim() || trimmed;
};

const extractFirstJsonValue = (value: string) => {
  const trimmed = unwrapJsonFence(value);

  for (let start = 0; start < trimmed.length; start++) {
    const opener = trimmed[start];
    if (opener !== "{" && opener !== "[") {
      continue;
    }

    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < trimmed.length; index++) {
      const char = trimmed[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === opener) {
        depth += 1;
      } else if (char === closer) {
        depth -= 1;

        if (depth === 0) {
          return trimmed.slice(start, index + 1);
        }
      }
    }
  }

  return trimmed;
};

const parseJson = <T>(value: string): T | null => {
  const normalized = unwrapJsonFence(value);

  try {
    return JSON.parse(normalized) as T;
  } catch {
    try {
      return JSON.parse(extractFirstJsonValue(value)) as T;
    } catch {
      return null;
    }
  }
};

const parseJobInputs = <T>(value: unknown): T | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as T;
};

type StructuredOutputFailureCategory =
  | "incomplete_structured_output"
  | "semantic_schema_violation"
  | "structured_output_shape_violation";

type JobFailurePayload = {
  message: string;
  code?: string;
  category?: StructuredOutputFailureCategory;
  templateId?: string;
  doneReason?: string | null;
  hint?: string;
  retryable?: boolean;
};

type DecisionSelectionRepairPlan = {
  patches: Array<{
    cardId: string;
    customSelection: string | null;
    reason: string;
    selectedOptionId: string | null;
  }>;
};

type MilestoneDesignFlowDraft = {
  deliveryGroupKeys?: unknown;
  screens?: unknown;
  steps?: unknown;
  summary?: string;
  title?: string;
};

type MilestoneDesignGroupConstraintDraft = boolean | string[];

type MilestoneDesignDraft = {
  deliveryGroups?: Array<{
    dependsOn?: unknown;
    key?: string;
    mustNotSplit?: MilestoneDesignGroupConstraintDraft;
    mustStayTogether?: MilestoneDesignGroupConstraintDraft;
    ownedResponsibilities?: unknown;
    ownedScreens?: unknown;
    summary?: string;
    title?: string;
  }>;
  dependenciesAndSequencing?: Array<{
    deliveryGroupKey?: string;
    deliveryGroupKeys?: unknown;
    description?: string;
    notes?: string;
    phase?: string | number;
  }>;
  exitCriteria?: Array<{
    criterion?: string;
    deliveryGroupKey?: string;
    screens?: unknown;
  }>;
  includedUserFlows?: MilestoneDesignFlowDraft[];
  objective?: string;
  scopeBoundaries?: {
    inScope?: Array<{
      deliveryGroupKey?: string;
      item?: string;
    }>;
    outOfScope?: unknown;
  };
  title?: string;
};

type ParsedMilestoneDesignGroupConstraint = {
  items: string[];
  wholeGroup: boolean;
};

type ParsedMilestoneDesignDraft = {
  deliveryGroups: Array<{
    dependsOn: string[];
    key: string;
    mustNotSplit: ParsedMilestoneDesignGroupConstraint;
    mustStayTogether: ParsedMilestoneDesignGroupConstraint;
    ownedResponsibilities: string[];
    ownedScreens: string[];
    summary: string;
    title: string;
  }>;
  dependenciesAndSequencing: Array<{
    deliveryGroupKeys: string[];
    notes: string;
    phase: string;
  }>;
  exitCriteria: Array<{
    criterion: string;
    deliveryGroupKey: string;
    screens: string[];
  }>;
  includedUserFlows: Array<{
    deliveryGroupKeys: string[];
    screens: string[];
    steps: string[];
    summary: string;
    title: string;
  }>;
  objective: string;
  scopeBoundaries: {
    inScope: Array<{
      deliveryGroupKey: string;
      item: string;
    }>;
    outOfScope: string[];
  };
  title: string;
};

const buildJsonRepairPrompt = (input: {
  contractGuidance?: string[];
  invalidResponse: string;
  templateId: string;
  validationMessage: string;
}) =>
  [
    "You are repairing an LLM response that must satisfy a strict JSON contract.",
    `The previous response for template "${input.templateId}" failed validation.`,
    `Validation error: ${input.validationMessage}`,
    "Return valid JSON only.",
    "Preserve the original scope and intent. Fix formatting, missing keys, invalid enums, or invalid JSON escaping as needed.",
    "Do not wrap the JSON in code fences.",
    ...(input.contractGuidance && input.contractGuidance.length > 0
      ? ["", "Contract guidance:", ...input.contractGuidance]
      : []),
    "",
    "Previous invalid response:",
    input.invalidResponse,
  ].join("\n");

const getStructuredOutputFailureMetadata = (input: {
  doneReason?: string | null;
  message: string;
  templateId: string;
}): Omit<JobFailurePayload, "message"> => {
  if (input.doneReason === "length") {
    return {
      code: "llm_output_truncated",
      category: "structured_output_shape_violation",
      templateId: input.templateId,
      doneReason: input.doneReason,
      retryable: false,
    };
  }

  if (
    input.message.includes("unsupported feature kind") ||
    input.message.includes("unsupported feature priority") ||
    input.message.includes("without featureKey") ||
    input.message.includes("invalid refresh payload") ||
    input.message.includes("no-op operation")
  ) {
    return {
      code: "llm_output_schema_mismatch",
      category: "semantic_schema_violation",
      templateId: input.templateId,
      doneReason: input.doneReason ?? null,
      retryable: true,
    };
  }

  if (
    input.message.includes("incomplete user flow") ||
    input.message.includes("incomplete feature") ||
    input.message.includes("without title") ||
    input.message.includes("without an answer") ||
    input.message.includes("without a question")
  ) {
    return {
      code: "llm_output_incomplete",
      category: "incomplete_structured_output",
      templateId: input.templateId,
      doneReason: input.doneReason ?? null,
      retryable: true,
    };
  }

  return {
    code: "llm_output_invalid",
    category: "structured_output_shape_violation",
    templateId: input.templateId,
    doneReason: input.doneReason ?? null,
    retryable: true,
  };
};

const createStructuredOutputFailure = (input: {
  doneReason?: string | null;
  message: string;
  templateId: string;
}) =>
  Object.assign(new Error(input.message), {
    jobError: {
      message: input.message,
      ...getStructuredOutputFailureMetadata(input),
    } satisfies JobFailurePayload,
  });

const createJobFailure = (input: JobFailurePayload) =>
  Object.assign(new Error(input.message), {
    jobError: input,
  });

const isStructuredOutputFailure = (error: unknown): error is Error & { jobError: JobFailurePayload } =>
  Boolean(
    error &&
      typeof error === "object" &&
      "jobError" in error &&
      typeof (error as { jobError?: JobFailurePayload }).jobError?.category === "string",
  );

const normalizeGeneratedFlowSteps = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((step) => {
      if (typeof step === "string") {
        return step.trim();
      }

      if (!step || typeof step !== "object") {
        return "";
      }

      const stepRecord = step as Record<string, unknown>;
      const action = typeof stepRecord.action === "string" ? stepRecord.action.trim() : "";
      const followUp = [
        typeof stepRecord.outcome === "string" ? stepRecord.outcome.trim() : "",
        typeof stepRecord.systemResponse === "string" ? stepRecord.systemResponse.trim() : "",
        typeof stepRecord.notes === "string" ? stepRecord.notes.trim() : "",
      ].filter(Boolean);

      if (action && followUp.length > 0) {
        return `${action} Outcome: ${followUp.join(" ")}`;
      }

      if (action) {
        return action;
      }

      return followUp.join(" ");
    })
    .filter((step) => step.length > 0);
};

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeOptionalStringList = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items.join("\n") : null;
};

const parseGeneratedUserFlowsResult = (
  value: string,
):
  | Array<{
      acceptanceCriteria?: string[];
      coverageTags?: string[];
      doneCriteriaRefs?: string[];
      endState?: string;
      entryPoint?: string;
      flowSteps?: unknown;
      source?: string;
      title?: string;
      userStory?: string;
    }>
  | null => {
  const parsed = parseJson<unknown>(value);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const parsedRecord = parsed as Record<string, unknown>;

  for (const key of ["userFlows", "flows", "useCases", "items"] as const) {
    const candidate = parsedRecord[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
};

const estimatePromptTokens = (prompt: string) => Math.ceil(prompt.length / 4);

const logProductSpecGeneration = (
  phase: "start" | "success" | "failure",
  input: {
    durationMs?: number;
    evalCount?: number | null;
    error?: unknown;
    jobId: string;
    model: string;
    outputChars?: number;
    phaseName: string;
    projectId: string;
    prompt: string;
    promptEvalCount?: number | null;
    provider: string;
    totalDuration?: number | null;
  },
) => {
  const base = {
    event: "product_spec_generation",
    phase: input.phaseName,
    status: phase,
    jobId: input.jobId,
    projectId: input.projectId,
    provider: input.provider,
    model: input.model,
    promptChars: input.prompt.length,
    approxPromptTokens: estimatePromptTokens(input.prompt),
  };

  if (phase === "start") {
    console.info(base);
    return;
  }

  if (phase === "success") {
    console.info({
      ...base,
      durationMs: input.durationMs,
      outputChars: input.outputChars ?? 0,
      promptEvalCount: input.promptEvalCount ?? null,
      evalCount: input.evalCount ?? null,
      totalDuration: input.totalDuration ?? null,
    });
    return;
  }

  const error =
    input.error instanceof Error
      ? {
          name: input.error.name,
          message: input.error.message,
          stack: input.error.stack,
        }
      : { message: String(input.error) };

  console.error({
    ...base,
    durationMs: input.durationMs,
    error,
  });
};

const parseProductSpecResult = (value: string, templateId: string) => {
  const parsed = parseJson<{ markdown?: string; title?: string }>(value);

  if (!parsed?.title?.trim() || !parsed?.markdown?.trim()) {
    throw new Error(
      `${templateId} returned invalid content. Expected JSON with non-empty "title" and "markdown".`,
    );
  }

  return {
    title: parsed.title.trim(),
    markdown: parsed.markdown.trim(),
  };
};

const parseProductSpecQualityCheckResult = (value: string, templateId: string) => {
  const parsed = parseJson<{ hasSignificantIssues?: boolean; hint?: string }>(value);

  if (parsed?.hasSignificantIssues === undefined) {
    throw new Error(
      `${templateId} returned invalid content. Expected JSON with "hasSignificantIssues" boolean.`,
    );
  }

  return {
    hasSignificantIssues: Boolean(parsed.hasSignificantIssues),
    hint: parsed.hint?.trim() ?? "",
  };
};

const parseFeatureWorkstreamResult = (value: string, templateId: string) => {
  const parsed = parseJson<{
    markdown?: string;
    requirements?: {
      archDocsRequired?: boolean;
      techRequired?: boolean;
      userDocsRequired?: boolean;
      uxRequired?: boolean;
    };
    title?: string;
  }>(value);

  if (!parsed?.title?.trim() || !parsed?.markdown?.trim()) {
    throw new Error(
      `${templateId} returned invalid content. Expected JSON with non-empty "title" and "markdown".`,
    );
  }

  const normalizedRequirements = parsed.requirements
    ? {
        uxRequired: parsed.requirements.uxRequired ?? true,
        techRequired: parsed.requirements.techRequired ?? true,
        userDocsRequired: parsed.requirements.userDocsRequired ?? true,
        archDocsRequired: parsed.requirements.archDocsRequired ?? true,
      }
    : null;

  const requirements = parsed.requirements
    ? createFeatureProductRevisionRequestSchema.shape.requirements.parse(normalizedRequirements)
    : null;

  return {
    title: parsed.title.trim(),
    markdown: parsed.markdown.trim(),
    requirements,
  };
};

const validateGeneratedUserFlows = (
  flows: Array<{
    acceptanceCriteria?: string[];
    coverageTags?: string[];
    doneCriteriaRefs?: string[];
    endState?: string;
    entryPoint?: string;
    flowSteps?: unknown;
    source?: string;
    title?: string;
    userStory?: string;
  }>,
) => {
  if (flows.length === 0) {
    throw new Error(
      "GenerateUseCases returned invalid content. Expected a non-empty JSON array of user flows.",
    );
  }

  return flows.map((flow) => {
    const flowSteps = normalizeGeneratedFlowSteps(flow.flowSteps);

    if (
      !flow.title?.trim() ||
      !flow.userStory?.trim() ||
      !flow.entryPoint?.trim() ||
      !flow.endState?.trim() ||
      flowSteps.length === 0
    ) {
      throw new Error(
        "GenerateUseCases returned an incomplete user flow. Each flow must include title, userStory, entryPoint, endState, and at least one flow step.",
      );
    }

    return {
      acceptanceCriteria: flow.acceptanceCriteria ?? ["The described flow can be completed."],
      coverageTags: flow.coverageTags ?? ["happy-path"],
      doneCriteriaRefs: flow.doneCriteriaRefs ?? ["product-spec"],
      endState: flow.endState,
      entryPoint: flow.entryPoint,
      flowSteps,
      source: flow.source ?? "generated",
      title: flow.title,
      userStory: flow.userStory,
    };
  });
};

const validateGeneratedDecisionDeck = (
  cards: Array<{
    alternatives?: Array<{
      description?: string;
      id?: string;
      label?: string;
    }>;
    category?: string;
    key?: string;
    prompt?: string;
    recommendation?: {
      description?: string;
      id?: string;
      label?: string;
    };
    title?: string;
  }>,
) => {
  if (cards.length === 0) {
    throw new Error(
      "GenerateDecisionDeck returned invalid content. Expected a non-empty JSON array of decision cards.",
    );
  }

  return cards.map((card) => {
    if (
      !card.key?.trim() ||
      !card.category?.trim() ||
      !card.title?.trim() ||
      !card.prompt?.trim() ||
      !card.recommendation?.id?.trim() ||
      !card.recommendation.label?.trim() ||
      !card.recommendation.description?.trim()
    ) {
      throw new Error(
        "GenerateDecisionDeck returned an incomplete decision card. Each card must include key, category, title, prompt, and a full recommendation.",
      );
    }

    if (!card.alternatives || card.alternatives.length < 2) {
      throw new Error(
        "GenerateDecisionDeck returned a card without at least two alternatives.",
      );
    }

    const alternatives = card.alternatives.map((option) => {
      if (!option.id?.trim() || !option.label?.trim() || !option.description?.trim()) {
        throw new Error(
          "GenerateDecisionDeck returned an alternative without id, label, and description.",
        );
      }

      return {
        id: option.id.trim(),
        label: option.label.trim(),
        description: option.description.trim(),
      };
    });

    return {
      key: card.key.trim(),
      category: card.category.trim(),
      title: card.title.trim(),
      prompt: card.prompt.trim(),
      recommendation: {
        id: card.recommendation.id.trim(),
        label: card.recommendation.label.trim(),
        description: card.recommendation.description.trim(),
      },
      alternatives,
    };
  });
};

const parseBlueprintResult = (value: string, templateId: string) => {
  const parsed = parseJson<{ markdown?: string; title?: string }>(value);

  if (!parsed?.title?.trim() || !parsed?.markdown?.trim()) {
    throw new Error(
      `${templateId} returned invalid content. Expected JSON with non-empty "title" and "markdown".`,
    );
  }

  return {
    title: parsed.title.trim(),
    markdown: parsed.markdown.trim(),
  };
};

const parseDecisionValidationResult = (value: string) => {
  const parsed = parseJson<{ issues?: string[]; ok?: boolean }>(value);

  if (!parsed || typeof parsed.ok !== "boolean" || !Array.isArray(parsed.issues)) {
    throw new Error(
      "ValidateDecisionConsistency returned invalid content. Expected JSON with boolean ok and string-array issues.",
    );
  }

  return parsed;
};

const normalizeStringArray = (
  value: unknown,
  errorMessage: string,
  { allowEmpty = false, unique = false }: { allowEmpty?: boolean; unique?: boolean } = {},
) => {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  const normalized = value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`${errorMessage} Invalid string at index ${index}.`);
    }

    return item.trim();
  });

  if (!allowEmpty && normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return unique ? [...new Set(normalized)] : normalized;
};

const normalizeStringArrayFromItems = (
  value: unknown,
  errorMessage: string,
  { allowEmpty = false, unique = false }: { allowEmpty?: boolean; unique?: boolean } = {},
) => {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  const normalized = value.map((item, index) => {
    if (typeof item === "string" && item.trim().length > 0) {
      return item.trim();
    }

    if (
      item &&
      typeof item === "object" &&
      "item" in item &&
      typeof (item as { item?: unknown }).item === "string" &&
      (item as { item: string }).item.trim().length > 0
    ) {
      return (item as { item: string }).item.trim();
    }

    throw new Error(`${errorMessage} Invalid item at index ${index}.`);
  });

  if (!allowEmpty && normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return unique ? [...new Set(normalized)] : normalized;
};

const normalizeMilestoneDesignGroupConstraint = (
  value: unknown,
  errorMessage: string,
): ParsedMilestoneDesignGroupConstraint => {
  if (typeof value === "boolean") {
    return {
      items: [],
      wholeGroup: value,
    };
  }

  return {
    items: normalizeStringArray(value, errorMessage, { allowEmpty: true, unique: true }),
    wholeGroup: false,
  };
};

const normalizeMilestoneDesignPhaseLabel = (
  value: unknown,
  errorMessage: string,
) => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `Phase ${value}`;
  }

  throw new Error(errorMessage);
};

const parseMilestoneDesignDraft = (
  value: string,
  templateId: string,
  options?: { allowEmptyIncludedUserFlows?: boolean },
): ParsedMilestoneDesignDraft => {
  const parsed = parseJson<MilestoneDesignDraft>(value);

  if (
    typeof parsed?.title !== "string" ||
    parsed.title.trim().length === 0 ||
    typeof parsed.objective !== "string" ||
    parsed.objective.trim().length === 0
  ) {
    throw new Error(
      `${templateId} returned invalid content. Expected non-empty "title" and "objective".`,
    );
  }

  const includedUserFlows = Array.isArray(parsed.includedUserFlows)
    ? parsed.includedUserFlows.map((flow, index) => {
        if (
          typeof flow?.title !== "string" ||
          flow.title.trim().length === 0 ||
          typeof flow.summary !== "string" ||
          flow.summary.trim().length === 0
        ) {
          throw new Error(
            `${templateId} returned an includedUserFlow without title or summary at index ${index}.`,
          );
        }

        return {
          title: flow.title.trim(),
          summary: flow.summary.trim(),
          steps: normalizeGeneratedFlowSteps(flow.steps),
          deliveryGroupKeys: normalizeStringArray(
            flow.deliveryGroupKeys,
            `${templateId} returned an includedUserFlow without deliveryGroupKeys at index ${index}.`,
            { unique: true },
          ),
          screens: normalizeStringArray(
            flow.screens,
            `${templateId} returned an includedUserFlow without screens at index ${index}.`,
            { unique: true },
          ),
        };
      })
    : null;

  if (
    !includedUserFlows ||
    (!options?.allowEmptyIncludedUserFlows && includedUserFlows.length === 0)
  ) {
    throw new Error(
      `${templateId} returned invalid content. Expected a non-empty "includedUserFlows" array.`,
    );
  }

  for (const [index, flow] of includedUserFlows.entries()) {
    if (flow.steps.length === 0) {
      throw new Error(
        `${templateId} returned an includedUserFlow without non-empty steps at index ${index}.`,
      );
    }
  }

  if (!parsed.scopeBoundaries || typeof parsed.scopeBoundaries !== "object") {
    throw new Error(`${templateId} returned invalid content. Expected "scopeBoundaries" object.`);
  }

  const inScope = Array.isArray(parsed.scopeBoundaries.inScope)
    ? parsed.scopeBoundaries.inScope.map((item, index) => {
        if (
          typeof item?.item !== "string" ||
          item.item.trim().length === 0 ||
          typeof item.deliveryGroupKey !== "string" ||
          item.deliveryGroupKey.trim().length === 0
        ) {
          throw new Error(
            `${templateId} returned an invalid inScope item at index ${index}.`,
          );
        }

        return {
          item: item.item.trim(),
          deliveryGroupKey: item.deliveryGroupKey.trim(),
        };
      })
    : null;

  if (!inScope || inScope.length === 0) {
    throw new Error(
      `${templateId} returned invalid content. Expected a non-empty "scopeBoundaries.inScope" array.`,
    );
  }

  const outOfScope = normalizeStringArrayFromItems(
    parsed.scopeBoundaries.outOfScope,
    `${templateId} returned invalid content. Expected "scopeBoundaries.outOfScope" array.`,
    { allowEmpty: true, unique: true },
  );

  const deliveryGroups = Array.isArray(parsed.deliveryGroups)
    ? parsed.deliveryGroups.map((group, index) => {
        if (
          typeof group?.key !== "string" ||
          group.key.trim().length === 0 ||
          typeof group.title !== "string" ||
          group.title.trim().length === 0 ||
          typeof group.summary !== "string" ||
          group.summary.trim().length === 0
        ) {
          throw new Error(
            `${templateId} returned an invalid deliveryGroup at index ${index}.`,
          );
        }

        return {
          key: group.key.trim(),
          title: group.title.trim(),
          summary: group.summary.trim(),
          ownedScreens: normalizeStringArray(
            group.ownedScreens ?? [],
            `${templateId} returned an invalid ownedScreens array for deliveryGroup ${group.key.trim()}.`,
            { allowEmpty: true, unique: true },
          ),
          ownedResponsibilities: normalizeStringArray(
            group.ownedResponsibilities,
            `${templateId} returned an invalid ownedResponsibilities array for deliveryGroup ${group.key.trim()}.`,
            { unique: true },
          ),
          dependsOn: normalizeStringArray(
            group.dependsOn ?? [],
            `${templateId} returned an invalid dependsOn array for deliveryGroup ${group.key.trim()}.`,
            { allowEmpty: true, unique: true },
          ),
          mustStayTogether: normalizeMilestoneDesignGroupConstraint(
            group.mustStayTogether ?? [],
            `${templateId} returned an invalid mustStayTogether value for deliveryGroup ${group.key.trim()}.`,
          ),
          mustNotSplit: normalizeMilestoneDesignGroupConstraint(
            group.mustNotSplit ?? [],
            `${templateId} returned an invalid mustNotSplit value for deliveryGroup ${group.key.trim()}.`,
          ),
        };
      })
    : null;

  if (!deliveryGroups || deliveryGroups.length === 0) {
    throw new Error(
      `${templateId} returned invalid content. Expected a non-empty "deliveryGroups" array.`,
    );
  }

  const dependenciesAndSequencing = Array.isArray(parsed.dependenciesAndSequencing)
    ? parsed.dependenciesAndSequencing.map((phase, index) => {
        const normalizedGroupKeys =
          typeof phase?.deliveryGroupKey === "string" &&
          phase.deliveryGroupKey.trim().length > 0 &&
          phase.deliveryGroupKeys === undefined
            ? [phase.deliveryGroupKey.trim()]
            : phase?.deliveryGroupKeys;
        const normalizedNotes =
          typeof phase?.notes === "string" && phase.notes.trim().length > 0
            ? phase.notes
            : phase?.description;

        if (
          (typeof phase?.phase !== "string" && typeof phase?.phase !== "number") ||
          (typeof normalizedNotes !== "string" || normalizedNotes.trim().length === 0)
        ) {
          throw new Error(
            `${templateId} returned an invalid dependenciesAndSequencing item at index ${index}.`,
          );
        }

        return {
          phase: normalizeMilestoneDesignPhaseLabel(
            phase.phase,
            `${templateId} returned an invalid dependenciesAndSequencing item at index ${index}.`,
          ),
          notes: normalizedNotes.trim(),
          deliveryGroupKeys: normalizeStringArray(
            normalizedGroupKeys,
            `${templateId} returned an invalid deliveryGroupKeys array for dependenciesAndSequencing item ${index}.`,
            { unique: true },
          ),
        };
      })
    : null;

  if (!dependenciesAndSequencing || dependenciesAndSequencing.length === 0) {
    throw new Error(
      `${templateId} returned invalid content. Expected a non-empty "dependenciesAndSequencing" array.`,
    );
  }

  const exitCriteria = Array.isArray(parsed.exitCriteria)
    ? parsed.exitCriteria.map((criterion, index) => {
        if (
          typeof criterion?.criterion !== "string" ||
          criterion.criterion.trim().length === 0 ||
          typeof criterion.deliveryGroupKey !== "string" ||
          criterion.deliveryGroupKey.trim().length === 0
        ) {
          throw new Error(`${templateId} returned an invalid exitCriteria item at index ${index}.`);
        }

        return {
          criterion: criterion.criterion.trim(),
          deliveryGroupKey: criterion.deliveryGroupKey.trim(),
          screens: normalizeStringArray(
            criterion.screens ?? [],
            `${templateId} returned an invalid screens array for exitCriteria item ${index}.`,
            { allowEmpty: true, unique: true },
          ),
        };
      })
    : null;

  if (!exitCriteria || exitCriteria.length === 0) {
    throw new Error(
      `${templateId} returned invalid content. Expected a non-empty "exitCriteria" array.`,
    );
  }

  return {
    title: parsed.title.trim(),
    objective: parsed.objective.trim(),
    includedUserFlows,
    scopeBoundaries: {
      inScope,
      outOfScope,
    },
    deliveryGroups,
    dependenciesAndSequencing,
    exitCriteria,
  };
};

const validateMilestoneDesignDraft = (
  draft: ParsedMilestoneDesignDraft,
  linkedFlows: Array<{ title: string }>,
) => {
  const issues: string[] = [];
  const linkedTitles = new Set(linkedFlows.map((flow) => flow.title.trim()));
  const seenFlowTitles = new Set<string>();
  const groupByKey = new Map<string, ParsedMilestoneDesignDraft["deliveryGroups"][number]>();
  const screenOwners = new Map<string, string>();
  const responsibilityOwners = new Map<string, string>();

  if (linkedTitles.size === 0 && draft.includedUserFlows.length > 0) {
    issues.push("Foundation milestones without linked user flows must leave Included User Flows empty.");
  }

  for (const group of draft.deliveryGroups) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.key)) {
      issues.push(`Delivery group "${group.key}" must use stable kebab-case.`);
    }

    if (groupByKey.has(group.key)) {
      issues.push(`Delivery group key "${group.key}" is duplicated.`);
      continue;
    }

    groupByKey.set(group.key, group);

    for (const screen of group.ownedScreens) {
      const existingOwner = screenOwners.get(screen);
      if (existingOwner && existingOwner !== group.key) {
        issues.push(`Screen "${screen}" is owned by both "${existingOwner}" and "${group.key}".`);
      } else {
        screenOwners.set(screen, group.key);
      }
    }

    for (const responsibility of group.ownedResponsibilities) {
      const existingOwner = responsibilityOwners.get(responsibility);
      if (existingOwner && existingOwner !== group.key) {
        issues.push(
          `Responsibility "${responsibility}" is owned by both "${existingOwner}" and "${group.key}".`,
        );
      } else {
        responsibilityOwners.set(responsibility, group.key);
      }
    }
  }

  for (const flow of draft.includedUserFlows) {
    if (!linkedTitles.has(flow.title)) {
      issues.push(`Included user flow "${flow.title}" is not linked to the milestone.`);
    }
    if (seenFlowTitles.has(flow.title)) {
      issues.push(`Included user flow "${flow.title}" appears more than once.`);
    }
    seenFlowTitles.add(flow.title);

    for (const groupKey of flow.deliveryGroupKeys) {
      if (!groupByKey.has(groupKey)) {
        issues.push(`Included user flow "${flow.title}" references unknown delivery group "${groupKey}".`);
      }
    }

    for (const screen of flow.screens) {
      const owner = screenOwners.get(screen);
      if (!owner) {
        issues.push(`Included user flow "${flow.title}" references unowned screen "${screen}".`);
      } else if (!flow.deliveryGroupKeys.includes(owner)) {
        issues.push(
          `Included user flow "${flow.title}" references screen "${screen}" but does not include owning delivery group "${owner}".`,
        );
      }
    }
  }

  if (linkedTitles.size > 0) {
    for (const linkedTitle of linkedTitles) {
      if (!seenFlowTitles.has(linkedTitle)) {
        issues.push(`Linked user flow "${linkedTitle}" is missing from Included User Flows.`);
      }
    }
  }

  for (const item of draft.scopeBoundaries.inScope) {
    if (!groupByKey.has(item.deliveryGroupKey)) {
      issues.push(`In-scope item "${item.item}" references unknown delivery group "${item.deliveryGroupKey}".`);
    }
  }

  for (const phase of draft.dependenciesAndSequencing) {
    for (const groupKey of phase.deliveryGroupKeys) {
      if (!groupByKey.has(groupKey)) {
        issues.push(`Sequencing phase "${phase.phase}" references unknown delivery group "${groupKey}".`);
      }
    }
  }

  for (const group of draft.deliveryGroups) {
    for (const dependencyKey of group.dependsOn) {
      if (!groupByKey.has(dependencyKey)) {
        issues.push(`Delivery group "${group.key}" depends on unknown group "${dependencyKey}".`);
      } else if (dependencyKey === group.key) {
        issues.push(`Delivery group "${group.key}" cannot depend on itself.`);
      } else if (groupByKey.get(dependencyKey)?.dependsOn.includes(group.key)) {
        issues.push(`Delivery groups "${group.key}" and "${dependencyKey}" form a dependency cycle.`);
      }
    }
  }

  for (const criterion of draft.exitCriteria) {
    const group = groupByKey.get(criterion.deliveryGroupKey);
    if (!group) {
      issues.push(`Exit criterion "${criterion.criterion}" references unknown delivery group "${criterion.deliveryGroupKey}".`);
      continue;
    }

    for (const screen of criterion.screens) {
      const owner = screenOwners.get(screen);
      if (!owner) {
        issues.push(`Exit criterion "${criterion.criterion}" references unowned screen "${screen}".`);
      } else if (owner !== group.key) {
        issues.push(
          `Exit criterion "${criterion.criterion}" references screen "${screen}" owned by "${owner}" instead of "${group.key}".`,
        );
      }
    }
  }

  const hint = issues[0] ?? "";
  return { ok: issues.length === 0, issues, hint };
};

const renderMilestoneDesignMarkdown = (draft: ParsedMilestoneDesignDraft) => {
  const lines = [
    "# Milestone Design",
    "",
    "## Milestone Objective",
    draft.objective,
    "",
    "## Included User Flows",
  ];

  if (draft.includedUserFlows.length === 0) {
    lines.push("This foundation milestone intentionally has no linked user flows.");
    lines.push("");
  } else {
    for (const flow of draft.includedUserFlows) {
      lines.push(`### ${flow.title}`);
      lines.push(flow.summary);
      lines.push("");
      lines.push("Steps:");
      for (const step of flow.steps) {
        lines.push(`- ${step}`);
      }
      lines.push("Delivery groups:");
      for (const groupKey of flow.deliveryGroupKeys) {
        lines.push(`- ${groupKey}`);
      }
      lines.push("Screens:");
      for (const screen of flow.screens) {
        lines.push(`- ${screen}`);
      }
      lines.push("");
    }
  }

  lines.push("## Scope Boundaries");
  lines.push("In scope:");
  for (const item of draft.scopeBoundaries.inScope) {
    lines.push(`- ${item.item} [owner: ${item.deliveryGroupKey}]`);
  }
  if (draft.scopeBoundaries.outOfScope.length > 0) {
    lines.push("Out of scope:");
    for (const item of draft.scopeBoundaries.outOfScope) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");
  lines.push("## Delivery Shape");
  for (const group of draft.deliveryGroups) {
    lines.push(`### ${group.title} (${group.key})`);
    lines.push(group.summary);
    lines.push("");
    lines.push("Owned screens:");
    for (const screen of group.ownedScreens) {
      lines.push(`- ${screen}`);
    }
    lines.push("Owned responsibilities:");
    for (const responsibility of group.ownedResponsibilities) {
      lines.push(`- ${responsibility}`);
    }
    if (group.dependsOn.length > 0) {
      lines.push("Depends on:");
      for (const dependency of group.dependsOn) {
        lines.push(`- ${dependency}`);
      }
    }
    if (group.mustStayTogether.wholeGroup || group.mustStayTogether.items.length > 0) {
      lines.push("Keep together:");
      if (group.mustStayTogether.wholeGroup) {
        lines.push("- Entire delivery group");
      }
      for (const item of group.mustStayTogether.items) {
        lines.push(`- ${item}`);
      }
    }
    if (group.mustNotSplit.wholeGroup || group.mustNotSplit.items.length > 0) {
      lines.push("Do not split:");
      if (group.mustNotSplit.wholeGroup) {
        lines.push("- Entire delivery group");
      }
      for (const item of group.mustNotSplit.items) {
        lines.push(`- ${item}`);
      }
    }
    lines.push("");
  }

  lines.push("## Dependencies and Sequencing");
  for (const phase of draft.dependenciesAndSequencing) {
    lines.push(`### ${phase.phase}`);
    lines.push(`Delivery groups: ${phase.deliveryGroupKeys.join(", ")}`);
    lines.push(phase.notes);
    lines.push("");
  }

  lines.push("## Exit Criteria");
  for (const criterion of draft.exitCriteria) {
    lines.push(`- ${criterion.criterion} [owner: ${criterion.deliveryGroupKey}; screens: ${criterion.screens.join(", ")}]`);
  }

  return lines.join("\n").trim();
};

const parseDecisionSelectionRepairPlan = (
  value: string,
  templateId: string,
): DecisionSelectionRepairPlan => {
  const parsed = parseJson<{
    patches?: Array<{
      cardId?: string;
      customSelection?: string | null;
      reason?: string;
      selectedOptionId?: string | null;
    }>;
  }>(value);

  if (!parsed || !Array.isArray(parsed.patches) || parsed.patches.length === 0) {
    throw new Error(
      `${templateId} returned invalid content. Expected JSON with a non-empty "patches" array.`,
    );
  }

  return {
    patches: parsed.patches.map((patch, index) => {
      if (!patch?.cardId?.trim()) {
        throw new Error(`${templateId} returned a patch without cardId at index ${index}.`);
      }

      if (!patch?.reason?.trim()) {
        throw new Error(`${templateId} returned a patch without reason at index ${index}.`);
      }

      const selectedOptionId =
        typeof patch.selectedOptionId === "string" && patch.selectedOptionId.trim().length > 0
          ? patch.selectedOptionId.trim()
          : null;
      const customSelection =
        typeof patch.customSelection === "string" && patch.customSelection.trim().length > 0
          ? patch.customSelection.trim()
          : null;

      if ((selectedOptionId ? 1 : 0) + (customSelection ? 1 : 0) !== 1) {
        throw new Error(
          `${templateId} must set exactly one of selectedOptionId or customSelection for patch ${patch.cardId.trim()}.`,
        );
      }

      return {
        cardId: patch.cardId.trim(),
        selectedOptionId,
        customSelection,
        reason: patch.reason.trim(),
      };
    }),
  };
};

const parseMilestonesResult = (
  value: string,
  templateId: string,
): Array<{
  title?: string;
  summary?: string;
  useCaseIds?: string[];
}> => {
  const parsed = parseJson<
    Array<{
      title?: string;
      summary?: string;
      useCaseIds?: string[];
    }>
  >(value);

  if (!Array.isArray(parsed)) {
    throw new Error(
      `${templateId} returned invalid content. Expected a JSON array of milestones.`,
    );
  }

  return parsed;
};

const validateGeneratedMilestones = (
  milestones: Array<{
    title?: string;
    summary?: string;
    useCaseIds?: string[];
  }>,
) => {
  if (milestones.length === 0) {
    throw new Error(
      "GenerateMilestones returned invalid content. Expected a non-empty JSON array of milestones.",
    );
  }

  return milestones.map((milestone, index) => {
    if (
      !milestone.title?.trim() ||
      !milestone.summary?.trim() ||
      !Array.isArray(milestone.useCaseIds)
    ) {
      throw new Error(
        "GenerateMilestones returned an incomplete milestone. Each milestone must include title, summary, and a useCaseIds array.",
      );
    }

    if (index > 0 && milestone.useCaseIds.length === 0) {
      throw new Error(
        "GenerateMilestones returned an incomplete milestone. Every milestone after the first foundation milestone must include at least one useCaseId.",
      );
    }

    return {
      title: milestone.title.trim(),
      summary: milestone.summary.trim(),
      useCaseIds: milestone.useCaseIds,
    };
  });
};

const buildUncoveredMilestoneFlowHint = (
  uncoveredFlows: Array<{
    title: string;
    userStory: string;
  }>,
) =>
  uncoveredFlows.length === 1
    ? `The approved user flow "${uncoveredFlows[0]!.title}" is not linked to any milestone. Add milestone coverage for it without losing the current delivery sequence.`
    : `The following approved user flows are not linked to any milestone: ${uncoveredFlows
        .map((flow) => `"${flow.title}"`)
        .join(", ")}. Add milestone coverage for all of them without changing the existing covered flows.`;

const parseGeneratedFeaturesResult = (
  value: string,
):
  | Array<{
      title?: string;
      summary?: string;
      acceptanceCriteria?: string[];
      kind?: string;
      priority?: string;
    }>
  | null => parseJson(value);

const parseTaskClarificationsResult = (
  value: string,
): Array<{ question: string; context?: string | null }> => {
  const parsed = parseJson<Array<{ question?: string; context?: unknown }>>(value);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      "GenerateTaskClarifications returned invalid content. Expected a non-empty JSON array.",
    );
  }

  return parsed.map((item) => {
    if (!item.question?.trim()) {
      throw new Error(
        "GenerateTaskClarifications returned an item without a question.",
      );
    }

    return {
      question: item.question.trim(),
      context: normalizeOptionalString(item.context),
    };
  });
};

const parseAutoAnswerResult = (
  value: string,
): Array<{ answer: string }> => {
  const parsed = parseJson<Array<{ answer?: unknown }>>(value);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "AutoAnswerTaskClarifications returned invalid content. Expected a JSON array.",
    );
  }

  return parsed.map((item) => {
    const answer = normalizeOptionalString(item.answer);

    if (!answer) {
      throw new Error(
        "AutoAnswerTaskClarifications returned an item without an answer.",
      );
    }

    return { answer };
  });
};

const parseTaskListResult = (
  value: string,
): Array<{
  title: string;
  description: string;
  instructions?: string | null;
  acceptanceCriteria: string[];
}> => {
  const parsed = parseJson<
    Array<{
      title?: string;
      description?: string;
      instructions?: unknown;
      acceptanceCriteria?: unknown;
    }>
  >(value);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      "GenerateFeatureTaskList returned invalid content. Expected a non-empty JSON array.",
    );
  }

  return parsed.map((item) => {
    if (!item.title?.trim() || !item.description?.trim()) {
      throw new Error(
        "GenerateFeatureTaskList returned an item without title or description.",
      );
    }

    return {
      title: item.title.trim(),
      description: item.description.trim(),
      instructions: normalizeOptionalStringList(item.instructions),
      acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
        ? item.acceptanceCriteria
            .filter((criterion): criterion is string => typeof criterion === "string")
            .map((criterion) => criterion.trim())
            .filter(Boolean)
        : [],
    };
  });
};

const parseMilestoneCoverageReviewResult = (value: string) => {
  const parsed = parseJson<{
    complete?: boolean;
    issues?: Array<{ action?: string; hint?: string }>;
  }>(value);

  if (!parsed || typeof parsed.complete !== "boolean") {
    throw new Error(
      'ReviewMilestoneCoverage returned invalid content. Expected JSON with a "complete" boolean.',
    );
  }

  const issues = (parsed.issues ?? [])
    .filter(
      (issue): issue is {
        action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
        hint: string;
      } =>
        (issue.action === "rewrite_feature_set" ||
          issue.action === "create_catch_up_feature" ||
          issue.action === "needs_human_review") &&
        typeof issue.hint === "string" &&
        issue.hint.trim().length > 0,
    )
    .map((issue) => ({
      action:
        issue.action === "create_catch_up_feature" ? "rewrite_feature_set" : issue.action,
      hint: issue.hint.trim(),
    }));

  return {
    complete: parsed.complete,
    issues,
  };
};

const parseMilestoneMapReviewResult = (value: string) => {
  const parsed = parseJson<{
    complete?: boolean;
    issues?: Array<{ action?: string; hint?: string; jobType?: string }>;
  }>(value);

  if (!parsed || typeof parsed.complete !== "boolean") {
    throw new Error(
      'ReviewMilestoneMap returned invalid content. Expected JSON with a "complete" boolean.',
    );
  }

  const issues = (parsed.issues ?? [])
    .flatMap((issue) => {
      if (
        issue.action === "rewrite_milestone_map" ||
        issue.action === "append_milestones" ||
        issue.action === "needs_human_review"
      ) {
        return [{ action: issue.action, hint: issue.hint }];
      }

      if (issue.jobType === "GenerateMilestones" && typeof issue.hint === "string") {
        return [{ action: "rewrite_milestone_map" as const, hint: issue.hint }];
      }

      if (issue.jobType === "AppendMilestones" && typeof issue.hint === "string") {
        return [{ action: "append_milestones" as const, hint: issue.hint }];
      }

      return [];
    })
    .filter(
      (
        issue,
      ): issue is {
        action: "rewrite_milestone_map" | "append_milestones" | "needs_human_review";
        hint: string;
      } =>
        (issue.action === "rewrite_milestone_map" ||
          issue.action === "append_milestones" ||
          issue.action === "needs_human_review") &&
        typeof issue.hint === "string" &&
        issue.hint.trim().length > 0,
    )
    .map((issue) => ({
      action: issue.action,
      hint: issue.hint.trim(),
    }));

  return {
    complete: parsed.complete,
    issues,
  };
};

const parseMilestoneDeliveryReviewResult = (value: string) => {
  const parsed = parseJson<{
    complete?: boolean;
    issues?: Array<{ action?: string; hint?: string }>;
  }>(value);

  if (!parsed || typeof parsed.complete !== "boolean") {
    throw new Error(
      'ReviewMilestoneDelivery returned invalid content. Expected JSON with a "complete" boolean.',
    );
  }

  const issues: Array<{ action: "refresh_artifacts" | "needs_human_review"; hint: string }> = [];
  for (const issue of parsed.issues ?? []) {
    if (typeof issue.hint !== "string" || issue.hint.trim().length === 0) {
      continue;
    }

    if (
      issue.action === "refresh_artifacts" ||
      issue.action === "rewrite_feature_set" ||
      issue.action === "create_catch_up_feature"
    ) {
      issues.push({ action: "refresh_artifacts", hint: issue.hint.trim() });
      continue;
    }

    if (issue.action === "needs_human_review") {
      issues.push({ action: "needs_human_review", hint: issue.hint.trim() });
    }
  }

  return {
    complete: parsed.complete,
    issues,
  };
};

const parseMilestoneCoverageIssuesInput = (
  issues: Array<{ action?: string; hint?: string }> | undefined,
) =>
  (issues ?? [])
    .filter(
      (issue): issue is {
        action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
        hint: string;
      } =>
        (issue.action === "rewrite_feature_set" ||
          issue.action === "create_catch_up_feature" ||
          issue.action === "needs_human_review") &&
        typeof issue.hint === "string" &&
        issue.hint.trim().length > 0,
    )
    .map((issue) => ({
      action:
        issue.action === "create_catch_up_feature" ? "rewrite_feature_set" : issue.action,
      hint: issue.hint.trim(),
    }));

type MilestoneCoverageRepairPlan = {
  resolved: boolean;
  defaultsChosen: Array<{
    issueIndex: number;
    decision: string;
    rationale: string;
  }>;
  operations: Array<{
    featureKey: string;
    featurePatch: {
      title: string;
      summary: string;
      acceptanceCriteria: string[];
    } | null;
    refresh: {
      product: boolean;
      ux: boolean;
      tech: boolean;
      userDocs: boolean;
      archDocs: boolean;
      tasks: boolean;
    };
    hint: string;
  }>;
  unresolvedReasons: string[];
};

const parseMilestoneCoverageRepairPlan = (
  value: string,
  templateId: string,
): MilestoneCoverageRepairPlan => {
  const parsed = parseJson<{
    resolved?: boolean;
    defaultsChosen?: Array<{
      issueIndex?: number;
      decision?: string;
      rationale?: string;
    }>;
    operations?: Array<{
      featureKey?: string;
      featurePatch?: {
        title?: string;
        summary?: string;
        acceptanceCriteria?: string[];
      } | null;
      refresh?: {
        product?: boolean;
        ux?: boolean;
        tech?: boolean;
        userDocs?: boolean;
        archDocs?: boolean;
        tasks?: boolean;
      };
      hint?: string;
    }>;
    unresolvedReasons?: string[];
  }>(value);

  if (!parsed || typeof parsed.resolved !== "boolean") {
    throw new Error(
      `${templateId} returned invalid content. Expected JSON with boolean "resolved".`,
    );
  }

  const defaultsChosen = Array.isArray(parsed.defaultsChosen)
    ? parsed.defaultsChosen.map((item, index) => {
        if (
          typeof item?.issueIndex !== "number" ||
          !Number.isInteger(item.issueIndex) ||
          !item?.decision?.trim() ||
          !item?.rationale?.trim()
        ) {
          throw new Error(
            `${templateId} returned an invalid defaultsChosen item at index ${index}.`,
          );
        }

        return {
          issueIndex: item.issueIndex,
          decision: item.decision.trim(),
          rationale: item.rationale.trim(),
        };
      })
    : [];

  const nonExecutableReasons: string[] = [];
  const operations = Array.isArray(parsed.operations)
    ? parsed.operations.flatMap((item, index) => {
        if (!item?.featureKey?.trim()) {
          nonExecutableReasons.push(
            `${templateId} returned a non-executable operation without featureKey.`,
          );
          return [];
        }

        const refresh = item.refresh;
        if (
          !refresh ||
          typeof refresh.product !== "boolean" ||
          typeof refresh.ux !== "boolean" ||
          typeof refresh.tech !== "boolean" ||
          typeof refresh.userDocs !== "boolean" ||
          typeof refresh.archDocs !== "boolean" ||
          typeof refresh.tasks !== "boolean"
        ) {
          nonExecutableReasons.push(
            `${templateId} returned an invalid refresh payload at operation ${index}.`,
          );
          return [];
        }

        let featurePatch: {
          title: string;
          summary: string;
          acceptanceCriteria: string[];
        } | null = null;
        if (item.featurePatch !== null && item.featurePatch !== undefined) {
          try {
            featurePatch = createFeatureRevisionRequestSchema
              .omit({ source: true })
              .parse(item.featurePatch);
          } catch {
            // If refresh has actionable flags, proceed without the patch
            if (Object.values(refresh).some(Boolean)) {
              featurePatch = null;
            } else {
              nonExecutableReasons.push(
                `${templateId} returned an invalid featurePatch at operation ${index} with no refresh flags.`,
              );
              return [];
            }
          }
        }

        // Silently skip no-op operations (no patch and no refresh flags)
        if (
          !featurePatch &&
          !Object.values(refresh).some(Boolean)
        ) {
          return [];
        }

        const hint = item.hint?.trim() || "Auto-repair operation";

        return [{
          featureKey: item.featureKey.trim(),
          featurePatch,
          refresh: {
            product: refresh.product,
            ux: refresh.ux,
            tech: refresh.tech,
            userDocs: refresh.userDocs,
            archDocs: refresh.archDocs,
            tasks: refresh.tasks,
          },
          hint,
        }];
      })
    : [];

  const unresolvedReasons = [
    ...(Array.isArray(parsed.unresolvedReasons)
    ? parsed.unresolvedReasons
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : []),
    ...nonExecutableReasons,
  ];

  return {
    resolved: parsed.resolved && nonExecutableReasons.length === 0,
    defaultsChosen,
    operations,
    unresolvedReasons,
  };
};

const FEATURE_KIND_ALIASES: Record<string, FeatureKind> = {
  component: "system",
  page: "screen",
  view: "screen",
  ui: "screen",
  api: "service",
  endpoint: "service",
  backend: "service",
  widget: "dialog",
  modal: "dialog",
  util: "library",
  utility: "library",
  helper: "library",
  ci: "pipeline",
  cd: "pipeline",
  workflow: "pipeline",
  placeholder: "placeholder_non_visual",
};

const PRIORITY_ALIASES: Record<string, Priority> = {
  must: "must_have",
  should: "should_have",
  could: "could_have",
  wont: "wont_have",
  high: "must_have",
  medium: "should_have",
  low: "could_have",
  critical: "must_have",
  nice_to_have: "could_have",
};

const resolveFeatureKind = (raw: string | undefined): FeatureKind => {
  const parsed = featureKindSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const normalized = raw?.toLowerCase().replace(/[^a-z_]/g, "").trim();
  if (normalized && normalized in FEATURE_KIND_ALIASES) {
    return FEATURE_KIND_ALIASES[normalized]!;
  }
  return "system";
};

const resolveFeaturePriority = (raw: string | undefined): Priority => {
  const parsed = prioritySchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const normalized = raw?.toLowerCase().replace(/[^a-z_]/g, "").trim();
  if (normalized && normalized in PRIORITY_ALIASES) {
    return PRIORITY_ALIASES[normalized]!;
  }
  return "should_have";
};

const validateGeneratedFeatures = (
  items: Array<{
    title?: string;
    summary?: string;
    acceptanceCriteria?: string[];
    kind?: string;
    priority?: string;
  }>,
  templateId = "GenerateMilestoneFeatureSet",
) => {
  if (items.length === 0) {
    throw new Error(
      `${templateId} returned invalid content. Expected a non-empty JSON array of features.`,
    );
  }

  return items.map((item) => {
    if (
      !item.title?.trim() ||
      !item.summary?.trim() ||
      !Array.isArray(item.acceptanceCriteria) ||
      item.acceptanceCriteria.length === 0
    ) {
      throw new Error(
        `${templateId} returned an incomplete feature. Each feature must include title, summary, and at least one acceptance criterion.`,
      );
    }

    return {
      title: item.title.trim(),
      summary: item.summary.trim(),
      acceptanceCriteria: item.acceptanceCriteria.map((criterion) => criterion.trim()),
      kind: resolveFeatureKind(item.kind),
      priority: resolveFeaturePriority(item.priority),
    };
  });
};

export const createJobRunnerService = (input: {
  artifactApprovalService: ArtifactApprovalService;
  bugService?: BugService;
  blueprintService: BlueprintService;
  contextPackService?: ContextPackService;
  db: AppDatabase;
  featureService?: FeatureService;
  featureWorkstreamService?: FeatureWorkstreamService;
  jobService: JobService;
  jobTraceService?: JobTraceService;
  llmProviderService: LlmProviderService;
  milestoneService?: MilestoneService;
  onePagerService: OnePagerService;
  productSpecService: ProductSpecService;
  projectService: ProjectService;
  projectReviewService?: ProjectReviewService;
  projectSetupService: ProjectSetupService;
  questionnaireService: QuestionnaireService;
  sandboxService?: SandboxService;
  userFlowService: UserFlowService;
}) => ({
  async run(jobId: string) {
    const rawJob = await input.jobService.getRawJob(jobId);

    if (!rawJob || !rawJob.projectId || !rawJob.createdByUserId) {
      throw new Error("Job context is incomplete.");
    }

    const ownerUserId = rawJob.createdByUserId;
    const projectId = rawJob.projectId;
    let llmStepCounter = 0;
    const autoAdvanceBatch = (rawJob.inputs as { _autoAdvance?: { batchToken?: string; sessionId?: string } } | null)?._autoAdvance;
    const project = await input.projectService.getOwnedProject(ownerUserId, projectId);
    const provider = await input.projectSetupService.getLlmDefinition(
      ownerUserId,
      projectId,
    );
    const assertAutoAdvanceBatchIsCurrent = async () => {
      if (!autoAdvanceBatch?.batchToken || !autoAdvanceBatch.sessionId) {
        return;
      }

      const session = await input.db.query.autoAdvanceSessionsTable.findFirst({
        where: eq(autoAdvanceSessionsTable.projectId, projectId),
      });

      if (
        !session ||
        session.id !== autoAdvanceBatch.sessionId ||
        session.activeBatchToken !== autoAdvanceBatch.batchToken
      ) {
        throw new Error("Auto-advance batch is no longer current.");
      }
    };

    const getScopedMilestone = async (milestoneId: string) =>
      input.db.query.milestonesTable.findFirst({
        where: and(
          eq(milestonesTable.id, milestoneId),
          eq(milestonesTable.projectId, projectId),
        ),
      });

    const loadApprovedProjectSpecs = async () => {
      const [productSpec, uxSpec, technicalSpec] = await Promise.all([
        input.productSpecService.getCanonical(ownerUserId, projectId),
        input.blueprintService.getCanonicalByKind(ownerUserId, projectId, "ux"),
        input.blueprintService.getCanonicalByKind(ownerUserId, projectId, "tech"),
      ]);

      if (!productSpec?.approvedAt) {
        throw new Error("Feature workstream generation requires an approved Product Spec.");
      }

      if (!uxSpec) {
        throw new Error("Feature workstream generation requires an approved UX Spec.");
      }

      if (!technicalSpec) {
        throw new Error("Feature workstream generation requires an approved Technical Spec.");
      }

      const [uxApproval, technicalApproval] = await Promise.all([
        input.artifactApprovalService.getApproval(projectId, "blueprint_ux", uxSpec.id),
        input.artifactApprovalService.getApproval(
          projectId,
          "blueprint_tech",
          technicalSpec.id,
        ),
      ]);

      if (!uxApproval) {
        throw new Error("Feature workstream generation requires an approved UX Spec.");
      }

      if (!technicalApproval) {
        throw new Error("Feature workstream generation requires an approved Technical Spec.");
      }

      return {
        productSpec,
        technicalSpec,
        uxSpec,
      };
    };

    const storeLlmRun = async (inputArgs: {
      templateId: string;
      parameters: Record<string, unknown>;
      prompt: string;
      generated: Awaited<ReturnType<LlmProviderService["generate"]>>;
    }) => {
      await assertAutoAdvanceBatchIsCurrent();
      await input.db.insert(llmRunsTable).values({
        id: generateId(),
        projectId: rawJob.projectId,
        jobId: rawJob.id,
        provider: provider.provider,
        model: provider.model,
        templateId: inputArgs.templateId,
        parameters: inputArgs.parameters,
        input: { prompt: inputArgs.prompt },
        output: {
          content: inputArgs.generated.content,
          doneReason: inputArgs.generated.doneReason ?? null,
          evalCount: inputArgs.generated.evalCount ?? null,
          promptEvalCount: inputArgs.generated.promptEvalCount ?? null,
          totalDuration: inputArgs.generated.totalDuration ?? null,
        },
        promptTokens: inputArgs.generated.promptTokens,
        completionTokens: inputArgs.generated.completionTokens,
        createdAt: new Date(),
      });
    };

    const publishTraceEvent = async (
      type: "job_status" | "llm_step_started" | "llm_step_finished" | "text_delta" | "reasoning_delta" | "output_link" | "error",
      payload: Record<string, unknown>,
    ) => {
      if (!rawJob.projectId) {
        return null;
      }

      return input.jobTraceService?.appendEvent({
        jobId: rawJob.id,
        projectId: rawJob.projectId,
        type,
        payload,
      });
    };

    const generateWithJobFailure = async (
      prompt: string,
      options?: {
        responseFormat?: "json";
        templateId?: string;
      },
    ) => {
      const stepKey = options?.templateId ? `${rawJob.id}:${++llmStepCounter}:${options.templateId}` : null;

      if (stepKey && options?.templateId) {
        await publishTraceEvent("llm_step_started", {
          key: stepKey,
          model: provider.model,
          provider: provider.provider,
          templateId: options?.templateId,
        });
      }

      try {
        const generated = await input.llmProviderService.generate(provider, prompt, {
          onStream: stepKey
            ? {
                onReasoningDelta: (delta) => {
                  void publishTraceEvent("reasoning_delta", {
                    key: stepKey,
                    text: delta,
                  });
                },
                onTextDelta: (delta) => {
                  void publishTraceEvent("text_delta", {
                    key: stepKey,
                    text: delta,
                  });
                },
              }
            : undefined,
          responseFormat: options?.responseFormat,
        });

        if (stepKey) {
          await publishTraceEvent("llm_step_finished", {
            key: stepKey,
            status: "succeeded",
            promptTokens: generated.promptTokens,
            completionTokens: generated.completionTokens,
          });
        }

        return generated;
      } catch (error) {
        if (stepKey) {
          await publishTraceEvent("llm_step_finished", {
            key: stepKey,
            status: "failed",
          }).catch(() => undefined);
        }

        const providerError =
          error && typeof error === "object" && "llmProviderError" in error
            ? (error as { llmProviderError: LlmProviderError }).llmProviderError
            : null;

        if (!providerError) {
          throw error;
        }

        throw createJobFailure({
          message: providerError.message,
          code:
            providerError.kind === "http_error"
              ? "llm_provider_http_error"
              : "llm_provider_transport_error",
          hint: providerError.message,
          retryable: providerError.retryable,
        });
      }
    };

    const parseStructuredJsonWithRepair = async <T>(inputArgs: {
      templateId: string;
      parameters: Record<string, unknown>;
      prompt: string;
      generated: Awaited<ReturnType<LlmProviderService["generate"]>>;
      parse: (content: string, templateId: string) => T;
    }) => {
      try {
        return inputArgs.parse(inputArgs.generated.content, inputArgs.templateId);
      } catch (error) {
        const validationMessage =
          error instanceof Error ? error.message : `${inputArgs.templateId} returned invalid content.`;

        if (inputArgs.generated.doneReason === "length") {
          throw createStructuredOutputFailure({
            message: validationMessage,
            templateId: inputArgs.templateId,
            doneReason: inputArgs.generated.doneReason,
          });
        }

        const repairTemplateId = `${inputArgs.templateId}Repair`;
        const repairPrompt = buildJsonRepairPrompt({
          templateId: inputArgs.templateId,
          validationMessage,
          invalidResponse: inputArgs.generated.content,
        });
        const repaired = await generateWithJobFailure(repairPrompt, {
          responseFormat: "json",
          templateId: repairTemplateId,
        });
        await storeLlmRun({
          templateId: repairTemplateId,
          parameters: {
            ...inputArgs.parameters,
            repairOf: inputArgs.templateId,
          },
          prompt: repairPrompt,
          generated: repaired,
        });

        try {
          return inputArgs.parse(repaired.content, inputArgs.templateId);
        } catch (repairError) {
          throw createStructuredOutputFailure({
            message:
              repairError instanceof Error ? repairError.message : validationMessage,
            templateId: inputArgs.templateId,
            doneReason: repaired.doneReason ?? inputArgs.generated.doneReason ?? null,
          });
        }
      }
    };

    const runStructuredJsonGeneration = async <T>(inputArgs: {
      templateId: string;
      parameters: Record<string, unknown>;
      prompt: string;
      parse: (content: string, templateId: string) => T;
    }) => {
      const generated = await generateWithJobFailure(inputArgs.prompt, {
        responseFormat: "json",
        templateId: inputArgs.templateId,
      });
      await storeLlmRun({
        templateId: inputArgs.templateId,
        parameters: inputArgs.parameters,
        prompt: inputArgs.prompt,
        generated,
      });

      return parseStructuredJsonWithRepair({
        templateId: inputArgs.templateId,
        parameters: inputArgs.parameters,
        prompt: inputArgs.prompt,
        generated,
        parse: inputArgs.parse,
      });
    };

    const runReviewedJsonGeneration = async <TDraft, TFinal = TDraft>(inputArgs: {
      templateId: string;
      reviewTemplateId?: string;
      parameters: Record<string, unknown>;
      prompt: string;
      parseDraft: (content: string, templateId: string) => TDraft;
      buildReviewPrompt: (draft: TDraft) => string;
      parseReviewed?: (content: string, templateId: string) => TFinal;
    }) => {
      const generated = await generateWithJobFailure(inputArgs.prompt, {
        responseFormat: "json",
        templateId: inputArgs.templateId,
      });
      await storeLlmRun({
        templateId: inputArgs.templateId,
        parameters: inputArgs.parameters,
        prompt: inputArgs.prompt,
        generated,
      });

      const draft = await parseStructuredJsonWithRepair({
        templateId: inputArgs.templateId,
        parameters: inputArgs.parameters,
        prompt: inputArgs.prompt,
        generated,
        parse: inputArgs.parseDraft,
      });
      const reviewTemplateId = inputArgs.reviewTemplateId ?? `${inputArgs.templateId}Review`;
      const reviewPrompt = inputArgs.buildReviewPrompt(draft);
      const reviewed = await generateWithJobFailure(reviewPrompt, {
        responseFormat: "json",
        templateId: reviewTemplateId,
      });
      await storeLlmRun({
        templateId: reviewTemplateId,
        parameters: inputArgs.parameters,
        prompt: reviewPrompt,
        generated: reviewed,
      });

      const parseReviewed = inputArgs.parseReviewed ?? ((content, templateId) =>
        inputArgs.parseDraft(content, templateId) as unknown as TFinal);

      return parseStructuredJsonWithRepair({
        templateId: reviewTemplateId,
        parameters: inputArgs.parameters,
        prompt: reviewPrompt,
        generated: reviewed,
        parse: parseReviewed,
      });
    };

    const loadMilestonePromptContext = async (
      milestoneId: string,
      currentFeatureId?: string,
    ) => {
      if (!input.milestoneService) {
        throw new Error("Feature planning prompts require milestone support.");
      }

      const milestone = await getScopedMilestone(milestoneId);
      const milestoneDesignDoc = await input.milestoneService.getCanonicalDesignDoc(
        ownerUserId,
        milestoneId,
      );

      if (!milestone || !milestoneDesignDoc) {
        throw new Error("Feature planning prompts require a canonical milestone design document.");
      }

      const siblingFeatures =
        input.featureService
          ? (
              await input.featureService.list(ownerUserId, projectId)
            ).features
              .filter(
                (feature) =>
                  feature.milestoneId === milestoneId && feature.id !== currentFeatureId,
              )
              .map((feature) => ({
                featureKey: feature.featureKey,
                title: feature.headRevision.title,
                summary: feature.headRevision.summary,
              }))
          : [];

      return {
        milestone,
        milestoneDesignDoc: milestoneDesignDoc.markdown,
        siblingFeatures,
      };
    };

    const taskPlanning = input.milestoneService
      ? createTaskPlanningService(input.db, input.milestoneService, input.featureWorkstreamService)
      : null;

    const buildFeatureContext = (inputArgs: {
      featureKey: string;
      title: string;
      summary: string;
      acceptanceCriteria: string[];
      milestoneTitle: string;
    }) => ({
      acceptanceCriteria: inputArgs.acceptanceCriteria,
      featureKey: inputArgs.featureKey,
      milestoneTitle: inputArgs.milestoneTitle,
      summary: inputArgs.summary,
      title: inputArgs.title,
    });

    const approveHeadRevision = async (
      featureId: string,
      kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
    ) => {
      if (!input.featureWorkstreamService) {
        throw new Error("Repair approval requires feature workstream support.");
      }

      const headRevision = await input.featureWorkstreamService.getHeadRevision(
        ownerUserId,
        featureId,
        kind,
      );

      if (!headRevision) {
        throw new Error(`Missing head ${kind} revision for feature ${featureId}.`);
      }

      if (!headRevision.approval) {
        await input.featureWorkstreamService.approveRevision(
          ownerUserId,
          featureId,
          kind,
          headRevision.id,
        );
      }
    };

    const repairDecisionSelections = async (inputArgs: {
      issues: string[];
      kind: "tech" | "ux";
      productSpec: string;
      uxSpec?: string;
    }) => {
      const { cards } = await input.blueprintService.listDecisionCards(
        ownerUserId,
        projectId,
        inputArgs.kind,
      );
      const currentSelections = JSON.stringify(
        await input.blueprintService.getDecisionSelections(
          ownerUserId,
          projectId,
          inputArgs.kind,
        ),
        null,
        2,
      );
      const serializedCards = cards.map((card) => ({
        id: card.id,
        key: card.key,
        title: card.title,
        recommendation: card.recommendation,
        alternatives: card.alternatives,
        selectedOptionId: card.selectedOptionId,
        customSelection: card.customSelection,
      }));

      const repairPlan = await runReviewedJsonGeneration({
        templateId: "RepairDecisionSelections",
        reviewTemplateId: "RepairDecisionSelectionsReview",
        parameters: {
          kind: inputArgs.kind,
          issueCount: inputArgs.issues.length,
        },
        prompt: buildDecisionSelectionRepairPrompt({
          cards: serializedCards,
          currentSelections,
          issues: inputArgs.issues,
          kind: inputArgs.kind,
          productSpec: inputArgs.productSpec,
          projectName: project.name,
          uxSpec: inputArgs.uxSpec,
        }),
        parseDraft: parseDecisionSelectionRepairPlan,
        buildReviewPrompt: (draftPlan) =>
          buildDecisionSelectionRepairReviewPrompt({
            cards: serializedCards,
            currentSelections,
            draftPlan,
            issues: inputArgs.issues,
            kind: inputArgs.kind,
            productSpec: inputArgs.productSpec,
            projectName: project.name,
            uxSpec: inputArgs.uxSpec,
          }),
      });

      const validCards = new Map(cards.map((card) => [card.id, card]));
      const patches = repairPlan.patches.map((patch) => {
        const card = validCards.get(patch.cardId);

        if (!card) {
          throw createJobFailure({
            message: `RepairDecisionSelections targeted an unknown decision card: ${patch.cardId}.`,
            code: "decision_repair_invalid_card",
            category: "semantic_schema_violation",
            templateId: "RepairDecisionSelections",
            retryable: false,
          });
        }

        if (
          patch.selectedOptionId &&
          ![card.recommendation, ...card.alternatives].some(
            (option) => option.id === patch.selectedOptionId,
          )
        ) {
          throw createJobFailure({
            message: `RepairDecisionSelections chose an invalid option for card ${card.key}.`,
            code: "decision_repair_invalid_option",
            category: "semantic_schema_violation",
            templateId: "RepairDecisionSelections",
            retryable: false,
          });
        }

        return {
          id: patch.cardId,
          selectedOptionId: patch.selectedOptionId,
          customSelection: patch.customSelection,
        };
      });

      await input.blueprintService.updateDecisionCards(
        ownerUserId,
        projectId,
        inputArgs.kind,
        { cards: patches },
      );
      await input.blueprintService.acceptDecisionDeck(
        ownerUserId,
        projectId,
        inputArgs.kind,
      );
    };

    const generateFeatureProductRevision = async (featureId: string, hint?: string | null) => {
      if (!input.featureWorkstreamService || !input.milestoneService) {
        throw new Error("GenerateFeatureProductSpec requires feature workstream support.");
      }

      const { productSpec, uxSpec, technicalSpec } = await loadApprovedProjectSpecs();
      const context = await input.featureWorkstreamService.getFeatureContext(
        ownerUserId,
        featureId,
      );
      const milestoneContext = await loadMilestonePromptContext(
        context.feature.milestoneId,
        featureId,
      );
      const featureContext = buildFeatureContext({
        acceptanceCriteria: Array.isArray(context.headFeatureRevision.acceptanceCriteria)
          ? context.headFeatureRevision.acceptanceCriteria.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        featureKey: context.feature.featureKey,
        milestoneTitle: milestoneContext.milestone.title,
        summary: context.headFeatureRevision.summary,
        title: context.headFeatureRevision.title,
      });

      const generatedSpec = await runReviewedJsonGeneration({
        templateId: "GenerateFeatureProductSpec",
        parameters: { featureId, ...(hint?.trim() ? { hint: hint.trim() } : {}) },
        prompt: buildFeatureProductSpecPrompt({
          feature: featureContext,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          siblingFeatures: milestoneContext.siblingFeatures,
          productSpec: productSpec.markdown,
          technicalSpec: technicalSpec.markdown,
          uxSpec: uxSpec.markdown,
          hint,
        }),
        parseDraft: parseFeatureWorkstreamResult,
        buildReviewPrompt: (draft) =>
          buildFeatureProductSpecReviewPrompt({
            feature: featureContext,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            siblingFeatures: milestoneContext.siblingFeatures,
            draftTitle: draft.title,
            draftMarkdown: draft.markdown,
            requirements:
              draft.requirements ?? {
                uxRequired: true,
                techRequired: true,
                userDocsRequired: true,
                archDocsRequired: true,
              },
            hint,
          }),
      });

      await input.featureWorkstreamService.createRevision(
        ownerUserId,
        featureId,
        "product",
        {
          markdown: generatedSpec.markdown,
          requirements:
            generatedSpec.requirements ?? {
              uxRequired: true,
              techRequired: true,
              userDocsRequired: true,
              archDocsRequired: true,
            },
          source: hint?.trim() ? "ResolveMilestoneCoverageIssues" : "GenerateFeatureProductSpec",
          title: generatedSpec.title,
        },
        rawJob.id,
      );
    };

    const generateFeatureWorkstreamRevision = async (
      featureId: string,
      kind: "ux" | "tech" | "user_docs" | "arch_docs",
      hint?: string | null,
    ) => {
      if (!input.featureWorkstreamService || !input.milestoneService) {
        throw new Error(`${kind} workstream generation requires feature workstream support.`);
      }

      const { productSpec, uxSpec, technicalSpec } = await loadApprovedProjectSpecs();
      const context = await input.featureWorkstreamService.getFeatureContext(
        ownerUserId,
        featureId,
      );
      const tracks = await input.featureWorkstreamService.getTracks(ownerUserId, featureId);
      const milestoneContext = await loadMilestonePromptContext(
        context.feature.milestoneId,
        featureId,
      );
      const featureContext = buildFeatureContext({
        acceptanceCriteria: Array.isArray(context.headFeatureRevision.acceptanceCriteria)
          ? context.headFeatureRevision.acceptanceCriteria.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        featureKey: context.feature.featureKey,
        milestoneTitle: milestoneContext.milestone.title,
        summary: context.headFeatureRevision.summary,
        title: context.headFeatureRevision.title,
      });

      let prompt = "";
      let workstreamLabel = "";

      if (kind === "ux") {
        if (!tracks.tracks.product.headRevision?.approval) {
          throw new Error("GenerateFeatureUxSpec requires an approved feature Product Spec.");
        }

        workstreamLabel = "feature UX Spec";
        prompt = buildFeatureUxSpecPrompt({
          featureProductSpec: tracks.tracks.product.headRevision.markdown,
          featureTitle: context.headFeatureRevision.title,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          projectProductSpec: productSpec.markdown,
          projectUxSpec: uxSpec.markdown,
          siblingFeatures: milestoneContext.siblingFeatures,
          hint,
        });
      } else if (kind === "tech") {
        if (!tracks.tracks.product.headRevision?.approval) {
          throw new Error("GenerateFeatureTechSpec requires an approved feature Product Spec.");
        }

        workstreamLabel = "feature Technical Spec";
        prompt = buildFeatureTechSpecPrompt({
          featureProductSpec: tracks.tracks.product.headRevision.markdown,
          featureTitle: context.headFeatureRevision.title,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          projectProductSpec: productSpec.markdown,
          projectTechnicalSpec: technicalSpec.markdown,
          siblingFeatures: milestoneContext.siblingFeatures,
          hint,
        });
      } else if (kind === "user_docs") {
        if (!tracks.tracks.product.headRevision?.approval) {
          throw new Error("GenerateFeatureUserDocs requires an approved feature Product Spec.");
        }

        workstreamLabel = "feature User Documentation";
        prompt = buildFeatureUserDocsPrompt({
          featureProductSpec: tracks.tracks.product.headRevision.markdown,
          featureTitle: context.headFeatureRevision.title,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          projectProductSpec: productSpec.markdown,
          projectUxSpec: uxSpec.markdown,
          siblingFeatures: milestoneContext.siblingFeatures,
          hint,
        });
      } else {
        if (tracks.tracks.tech.required && !tracks.tracks.tech.headRevision?.approval) {
          throw new Error(
            `Cannot generate architecture docs for "${context.headFeatureRevision.title}": the feature tech spec must be approved first.`,
          );
        }

        workstreamLabel = "feature Architecture Documentation";
        prompt = buildFeatureArchDocsPrompt({
          featureTechSpec: tracks.tracks.tech.headRevision?.markdown ?? null,
          featureTitle: context.headFeatureRevision.title,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          projectTechnicalSpec: technicalSpec.markdown,
          siblingFeatures: milestoneContext.siblingFeatures,
          hint,
        });
      }

      const generatedSpec = await runReviewedJsonGeneration({
        templateId:
          kind === "ux"
            ? "GenerateFeatureUxSpec"
            : kind === "tech"
              ? "GenerateFeatureTechSpec"
              : kind === "user_docs"
                ? "GenerateFeatureUserDocs"
                : "GenerateFeatureArchDocs",
        parameters: { featureId, kind, ...(hint?.trim() ? { hint: hint.trim() } : {}) },
        prompt,
        parseDraft: parseFeatureWorkstreamResult,
        buildReviewPrompt: (draft) =>
          buildFeatureWorkstreamReviewPrompt({
            workstreamLabel,
            feature: featureContext,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            siblingFeatures: milestoneContext.siblingFeatures,
            draftTitle: draft.title,
            draftMarkdown: draft.markdown,
            hint,
          }),
      });

      await input.featureWorkstreamService.createRevision(
        ownerUserId,
        featureId,
        kind,
        {
          markdown: generatedSpec.markdown,
          source: hint?.trim() ? "ResolveMilestoneCoverageIssues" : workstreamLabel,
          title: generatedSpec.title,
        },
        rawJob.id,
      );
    };

    const regenerateFeatureTasks = async (featureId: string, hint?: string | null) => {
      if (!taskPlanning || !input.featureWorkstreamService || !input.milestoneService) {
        throw new Error("Task repair requires task planning and feature workstream support.");
      }

      const session = await taskPlanning.getOrCreateSession(ownerUserId, featureId);
      const context = await taskPlanning.getFeatureContext(ownerUserId, featureId);
      const milestoneContext = await loadMilestonePromptContext(
        context.feature.milestoneId,
        featureId,
      );
      const tracks = await input.featureWorkstreamService.getTracks(ownerUserId, featureId);
      if (!isTaskPlanningReady(tracks.tracks)) {
        throw new Error(buildTaskPlanningReadinessMessage(tracks.tracks));
      }
      const planningDocuments = buildTaskPlanningDocuments(tracks.tracks);

      const featureContext = buildFeatureContext({
        acceptanceCriteria: context.headFeatureRevision.acceptanceCriteria as string[],
        featureKey: context.feature.featureKey,
        milestoneTitle: milestoneContext.milestone.title,
        summary: context.headFeatureRevision.summary,
        title: context.headFeatureRevision.title,
      });

      const clarificationsPrompt = buildTaskClarificationsPrompt({
        feature: featureContext,
        milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
        planningDocuments,
        hint,
      });
      await taskPlanning.createClarifications(
        session.id,
        await runStructuredJsonGeneration({
          templateId: "GenerateTaskClarifications",
          parameters: {
            featureId,
            sessionId: session.id,
            ...(hint?.trim() ? { hint: hint.trim() } : {}),
          },
          prompt: clarificationsPrompt,
          parse: (content) => parseTaskClarificationsResult(content),
        }),
      );

      const pendingClarifications = await taskPlanning.getClarifications(ownerUserId, session.id);
      const autoAnswerPrompt = buildAutoAnswerClarificationsPrompt({
        clarifications: pendingClarifications.map((item) => ({
          question: item.question,
          context: item.context,
        })),
        feature: featureContext,
        milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
        planningDocuments,
        hint,
      });
      const answers = await runStructuredJsonGeneration({
        templateId: "AutoAnswerTaskClarifications",
        parameters: {
          featureId,
          sessionId: session.id,
          ...(hint?.trim() ? { hint: hint.trim() } : {}),
        },
        prompt: autoAnswerPrompt,
        parse: (content) => parseAutoAnswerResult(content),
      });
      for (let index = 0; index < Math.min(pendingClarifications.length, answers.length); index++) {
        await taskPlanning.answerClarification(
          ownerUserId,
          featureId,
          pendingClarifications[index]!.id,
          answers[index]!.answer,
          "auto",
        );
      }

      const answeredClarifications = await taskPlanning.getClarifications(ownerUserId, session.id);
      const tasks = await runReviewedJsonGeneration({
        templateId: "GenerateFeatureTaskList",
        parameters: { featureId, sessionId: session.id, ...(hint?.trim() ? { hint: hint.trim() } : {}) },
        prompt: buildFeatureTaskListPrompt({
          clarifications: answeredClarifications
            .filter((item) => item.status === "answered")
            .map((item) => ({
              question: item.question,
              answer: item.answer ?? "",
            })),
          feature: featureContext,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          planningDocuments,
          hint,
        }),
        parseDraft: (content) => parseTaskListResult(content),
        buildReviewPrompt: (draftTasks) =>
          buildFeatureTaskListReviewPrompt({
            feature: featureContext,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            planningDocuments,
            draftTasks,
            hint,
          }),
      });

      await taskPlanning.createTasks(session.id, tasks);
    };

    switch (rawJob.type) {
      case "AutoAnswerQuestionnaire": {
        const questionnaire = await input.questionnaireService.getAnswers(rawJob.projectId);
        const blankKeys = new Set(
          questionnaireDefinition
            .map((question) => question.key)
            .filter((key) => !questionnaire.answers[key]?.trim()),
        );

        if (blankKeys.size === 0) {
          return input.jobService.markSucceeded(rawJob.id, {
            answeredKeys: [],
            completedAt: questionnaire.completedAt,
          });
        }

        const prompt = buildQuestionnaireAutoAnswerPrompt({
          projectName: project.name,
          projectDescription: project.description,
          answers: questionnaire.answers,
        });
        const parsedAnswers = questionnaireAnswerMapSchema.parse(
          await runStructuredJsonGeneration({
            templateId: "AutoAnswerQuestionnaire",
            parameters: {},
            prompt,
            parse: (content, templateId) => {
              const parsed = parseJson<Record<string, string>>(content);

              if (!parsed) {
                throw new Error(
                  `${templateId} returned invalid content. Expected a JSON object keyed by questionnaire fields.`,
                );
              }

              return parsed;
            },
          }),
        );
        const filteredAnswers = Object.fromEntries(
          Object.entries(parsedAnswers).filter(
            ([key, value]) => blankKeys.has(key as (typeof questionnaireDefinition)[number]["key"]) && typeof value === "string" && value.trim(),
          ),
        );
        const updatedQuestionnaire = await input.questionnaireService.upsertAnswers(
          rawJob.projectId,
          filteredAnswers,
        );

        return input.jobService.markSucceeded(rawJob.id, {
          answeredKeys: Object.keys(filteredAnswers),
          completedAt: updatedQuestionnaire.completedAt,
        });
      }

      case "GenerateProjectOverview":
      case "RegenerateProjectOverview":
      case "GenerateOverviewImprovements": {
        const questionnaire = await input.questionnaireService.getAnswers(rawJob.projectId);
        const prompt = buildProjectOverviewPrompt({
          projectName: project.name,
          projectDescription: project.description,
          answers: questionnaire.answers,
        });
        const parsed = await runStructuredJsonGeneration({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          parse: (content, templateId) => {
            const parsedResult = parseJson<{
              description?: string;
              markdown?: string;
              title?: string;
            }>(content);

            if (
              !parsedResult?.title?.trim() ||
              !parsedResult?.description?.trim() ||
              !parsedResult?.markdown?.trim()
            ) {
              throw new Error(
                `${templateId} returned invalid content. Expected JSON with non-empty "title", "description", and "markdown".`,
              );
            }

            return {
              title: parsedResult.title.trim(),
              description: parsedResult.description.trim(),
              markdown: parsedResult.markdown.trim(),
            };
          },
        });

        await input.projectService.updateOwnedProject(ownerUserId, rawJob.projectId, {
          description: parsed.description,
        });

        const onePager = await input.onePagerService.createVersion({
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          source: rawJob.type,
          title: parsed.title,
          markdown: parsed.markdown,
        });

        return input.jobService.markSucceeded(rawJob.id, { onePagerId: onePager.id });
      }

      case "GenerateProductSpec":
      case "RegenerateProductSpec":
      case "GenerateProductSpecImprovements": {
        const onePager = await input.onePagerService.getCanonical(ownerUserId, rawJob.projectId);

        if (!onePager?.approvedAt) {
          throw new Error(
            "GenerateProductSpec requires an approved overview document before the Product Spec can be generated.",
          );
        }

        const productSpecQuestionnaire = await input.questionnaireService.getAnswers(rawJob.projectId);
        const productSpecSizeProfile = classifyProjectSize(productSpecQuestionnaire.answers);

        const prompt = buildProductSpecPrompt({
          projectName: project.name,
          sourceMaterial: onePager.markdown,
          sizeProfile: productSpecSizeProfile,
        });
        const firstPassStartedAt = Date.now();
        logProductSpecGeneration("start", {
          jobId: rawJob.id,
          projectId: rawJob.projectId,
          provider: provider.provider,
          model: provider.model,
          phaseName: rawJob.type,
          prompt,
        });
        let generated;
        try {
          generated = await generateWithJobFailure(prompt, {
            responseFormat: "json",
            templateId: rawJob.type,
          });
        } catch (error) {
          logProductSpecGeneration("failure", {
            jobId: rawJob.id,
            projectId: rawJob.projectId,
            provider: provider.provider,
            model: provider.model,
            phaseName: rawJob.type,
            prompt,
            durationMs: Date.now() - firstPassStartedAt,
            error,
          });
          throw error;
        }
        logProductSpecGeneration("success", {
          jobId: rawJob.id,
          projectId: rawJob.projectId,
          provider: provider.provider,
          model: provider.model,
          phaseName: rawJob.type,
          prompt,
          durationMs: Date.now() - firstPassStartedAt,
          outputChars: generated.content.length,
          promptEvalCount: generated.promptEvalCount,
          evalCount: generated.evalCount,
          totalDuration: generated.totalDuration,
        });
        await assertAutoAdvanceBatchIsCurrent();
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: {},
          input: { prompt },
          output: {
            content: generated.content,
            doneReason: generated.doneReason ?? null,
            evalCount: generated.evalCount ?? null,
            promptEvalCount: generated.promptEvalCount ?? null,
            totalDuration: generated.totalDuration ?? null,
          },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const firstPass = await parseStructuredJsonWithRepair({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          generated,
          parse: parseProductSpecResult,
        });

        // Quality check pass: detect significant domain or content failures before the tidy review.
        const qualityCheckTemplateId = `${rawJob.type}QualityCheck`;
        const qualityCheckPrompt = buildProductSpecQualityCheckPrompt({
          projectName: project.name,
          draftTitle: firstPass.title,
          draftMarkdown: firstPass.markdown,
        });
        const qualityCheckStartedAt = Date.now();
        logProductSpecGeneration("start", {
          jobId: rawJob.id,
          projectId: rawJob.projectId,
          provider: provider.provider,
          model: provider.model,
          phaseName: qualityCheckTemplateId,
          prompt: qualityCheckPrompt,
        });
        let qualityChecked;
        try {
          qualityChecked = await generateWithJobFailure(qualityCheckPrompt, {
            responseFormat: "json",
            templateId: qualityCheckTemplateId,
          });
        } catch (error) {
          logProductSpecGeneration("failure", {
            jobId: rawJob.id,
            projectId: rawJob.projectId,
            provider: provider.provider,
            model: provider.model,
            phaseName: qualityCheckTemplateId,
            prompt: qualityCheckPrompt,
            durationMs: Date.now() - qualityCheckStartedAt,
            error,
          });
          throw error;
        }
        logProductSpecGeneration("success", {
          jobId: rawJob.id,
          projectId: rawJob.projectId,
          provider: provider.provider,
          model: provider.model,
          phaseName: qualityCheckTemplateId,
          prompt: qualityCheckPrompt,
          durationMs: Date.now() - qualityCheckStartedAt,
          outputChars: qualityChecked.content.length,
          promptEvalCount: qualityChecked.promptEvalCount,
          evalCount: qualityChecked.evalCount,
          totalDuration: qualityChecked.totalDuration,
        });
        await assertAutoAdvanceBatchIsCurrent();
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: qualityCheckTemplateId,
          parameters: {},
          input: { prompt: qualityCheckPrompt },
          output: {
            content: qualityChecked.content,
            doneReason: qualityChecked.doneReason ?? null,
            evalCount: qualityChecked.evalCount ?? null,
            promptEvalCount: qualityChecked.promptEvalCount ?? null,
            totalDuration: qualityChecked.totalDuration ?? null,
          },
          promptTokens: qualityChecked.promptTokens,
          completionTokens: qualityChecked.completionTokens,
          createdAt: new Date(),
        });
        const qualityCheck = await parseStructuredJsonWithRepair({
          templateId: qualityCheckTemplateId,
          parameters: {},
          prompt: qualityCheckPrompt,
          generated: qualityChecked,
          parse: parseProductSpecQualityCheckResult,
        });

        // If significant issues were found, re-generate with a hint before the tidy review.
        let specToReview = firstPass;
        if (qualityCheck.hasSignificantIssues) {
          const retryPrompt = buildProductSpecPrompt({
            projectName: project.name,
            sourceMaterial: onePager.markdown,
            hint: qualityCheck.hint,
          });
          const retryTemplateId = `${rawJob.type}Retry`;
          const retryStartedAt = Date.now();
          logProductSpecGeneration("start", {
            jobId: rawJob.id,
            projectId: rawJob.projectId,
            provider: provider.provider,
            model: provider.model,
            phaseName: retryTemplateId,
            prompt: retryPrompt,
          });
          let retried;
          try {
            retried = await generateWithJobFailure(retryPrompt, {
              responseFormat: "json",
              templateId: retryTemplateId,
            });
          } catch (error) {
            logProductSpecGeneration("failure", {
              jobId: rawJob.id,
              projectId: rawJob.projectId,
              provider: provider.provider,
              model: provider.model,
              phaseName: retryTemplateId,
              prompt: retryPrompt,
              durationMs: Date.now() - retryStartedAt,
              error,
            });
            throw error;
          }
          logProductSpecGeneration("success", {
            jobId: rawJob.id,
            projectId: rawJob.projectId,
            provider: provider.provider,
            model: provider.model,
            phaseName: retryTemplateId,
            prompt: retryPrompt,
            durationMs: Date.now() - retryStartedAt,
            outputChars: retried.content.length,
            promptEvalCount: retried.promptEvalCount,
            evalCount: retried.evalCount,
            totalDuration: retried.totalDuration,
          });
          await assertAutoAdvanceBatchIsCurrent();
          await input.db.insert(llmRunsTable).values({
            id: generateId(),
            projectId: rawJob.projectId,
            jobId: rawJob.id,
            provider: provider.provider,
            model: provider.model,
            templateId: retryTemplateId,
            parameters: {},
            input: { prompt: retryPrompt },
            output: {
              content: retried.content,
              doneReason: retried.doneReason ?? null,
              evalCount: retried.evalCount ?? null,
              promptEvalCount: retried.promptEvalCount ?? null,
              totalDuration: retried.totalDuration ?? null,
            },
            promptTokens: retried.promptTokens,
            completionTokens: retried.completionTokens,
            createdAt: new Date(),
          });
          specToReview = await parseStructuredJsonWithRepair({
            templateId: retryTemplateId,
            parameters: {},
            prompt: retryPrompt,
            generated: retried,
            parse: parseProductSpecResult,
          });
        }

        const reviewPrompt = buildProductSpecReviewPrompt({
          projectName: project.name,
          draftTitle: specToReview.title,
          draftMarkdown: specToReview.markdown,
        });
        const reviewTemplateId = `${rawJob.type}Review`;
        const reviewStartedAt = Date.now();
        logProductSpecGeneration("start", {
          jobId: rawJob.id,
          projectId: rawJob.projectId,
          provider: provider.provider,
          model: provider.model,
          phaseName: reviewTemplateId,
          prompt: reviewPrompt,
        });
        let reviewed;
        try {
          reviewed = await generateWithJobFailure(reviewPrompt, {
            responseFormat: "json",
            templateId: reviewTemplateId,
          });
        } catch (error) {
          logProductSpecGeneration("failure", {
            jobId: rawJob.id,
            projectId: rawJob.projectId,
            provider: provider.provider,
            model: provider.model,
            phaseName: reviewTemplateId,
            prompt: reviewPrompt,
            durationMs: Date.now() - reviewStartedAt,
            error,
          });
          throw error;
        }
        logProductSpecGeneration("success", {
          jobId: rawJob.id,
          projectId: rawJob.projectId,
          provider: provider.provider,
          model: provider.model,
          phaseName: reviewTemplateId,
          prompt: reviewPrompt,
          durationMs: Date.now() - reviewStartedAt,
          outputChars: reviewed.content.length,
          promptEvalCount: reviewed.promptEvalCount,
          evalCount: reviewed.evalCount,
          totalDuration: reviewed.totalDuration,
        });
        await assertAutoAdvanceBatchIsCurrent();
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: reviewTemplateId,
          parameters: {},
          input: { prompt: reviewPrompt },
          output: {
            content: reviewed.content,
            doneReason: reviewed.doneReason ?? null,
            evalCount: reviewed.evalCount ?? null,
            promptEvalCount: reviewed.promptEvalCount ?? null,
            totalDuration: reviewed.totalDuration ?? null,
          },
          promptTokens: reviewed.promptTokens,
          completionTokens: reviewed.completionTokens,
          createdAt: new Date(),
        });
        const reviewedProductSpec = await parseStructuredJsonWithRepair({
          templateId: reviewTemplateId,
          parameters: {},
          prompt: reviewPrompt,
          generated: reviewed,
          parse: parseProductSpecResult,
        });

        const productSpec = await input.productSpecService.createVersion({
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          source: rawJob.type,
          title: reviewedProductSpec.title,
          markdown: reviewedProductSpec.markdown,
        });

        return input.jobService.markSucceeded(rawJob.id, { productSpecId: productSpec.id });
      }

      case "GenerateUseCases": {
        const productSpec = await input.productSpecService.getCanonical(
          ownerUserId,
          rawJob.projectId,
        );
        const technicalSpec = await input.blueprintService.getCanonicalByKind(
          ownerUserId,
          rawJob.projectId,
          "tech",
        );

        if (!productSpec?.approvedAt) {
          throw new Error(
            "GenerateUseCases requires an approved Product Spec before user flows can be generated.",
          );
        }

        if (!technicalSpec) {
          throw new Error(
            "GenerateUseCases requires an approved Technical Spec before user flows can be generated.",
          );
        }

        const technicalSpecApproval = await input.artifactApprovalService.getApproval(
          rawJob.projectId,
          "blueprint_tech",
          technicalSpec.id,
        );

        if (!technicalSpecApproval) {
          throw new Error(
            "GenerateUseCases requires an approved Technical Spec before user flows can be generated.",
          );
        }

        const generateUseCasesInput = parseJobInputs<{ hint?: string }>(rawJob.inputs);
        const prompt = buildUserFlowPrompt({
          projectName: project.name,
          sourceMaterial: `${productSpec.markdown}\n\n# Technical Spec\n\n${technicalSpec.markdown}`,
          hint: generateUseCasesInput?.hint,
        });
        const flowsToCreate = validateGeneratedUserFlows(
          await runStructuredJsonGeneration({
            templateId: rawJob.type,
            parameters: {},
            prompt,
            parse: (content) => {
              const parsed = parseGeneratedUserFlowsResult(content);

              if (!parsed || parsed.length === 0) {
                throw new Error(
                  "GenerateUseCases returned invalid content. Expected a non-empty JSON array of user flows.",
                );
              }

              return parsed;
            },
          }),
        );
        await input.userFlowService.createMany(ownerUserId, rawJob.projectId, flowsToCreate);

        return input.jobService.markSucceeded(rawJob.id, { createdCount: flowsToCreate.length });
      }

      case "DeduplicateUseCases": {
        const activeFlows = await input.db.query.useCasesTable.findMany({
          where: and(
            eq(useCasesTable.projectId, rawJob.projectId),
            isNull(useCasesTable.archivedAt),
          ),
        });
        const seen = new Set<string>();
        const archivedIds: string[] = [];

        for (const flow of activeFlows) {
          const normalized = flow.title.trim().toLowerCase();
          if (seen.has(normalized)) {
            await input.userFlowService.archive(ownerUserId, flow.id);
            archivedIds.push(flow.id);
            continue;
          }

          seen.add(normalized);
        }

        return input.jobService.markSucceeded(rawJob.id, { archivedIds });
      }

      case "GenerateDecisionDeck": {
        const productSpec = await input.productSpecService.getCanonical(ownerUserId, rawJob.projectId);
        const jobInput = parseJobInputs<{ kind?: "tech" | "ux" }>(rawJob.inputs);
        const kind = jobInput?.kind;

        if (!kind) {
          throw new Error("GenerateDecisionDeck requires a decision kind.");
        }

        if (!productSpec?.approvedAt) {
          throw new Error("GenerateDecisionDeck requires an approved Product Spec.");
        }

        const uxSpec =
          kind === "tech"
            ? await input.blueprintService.getCanonicalByKind(ownerUserId, rawJob.projectId, "ux")
            : null;

        if (kind === "tech") {
          if (!uxSpec) {
            throw new Error(
              "GenerateDecisionDeck requires an approved UX Spec before technical decisions.",
            );
          }

          const uxApproval = await input.artifactApprovalService.getApproval(
            rawJob.projectId,
            "blueprint_ux",
            uxSpec.id,
          );

          if (!uxApproval) {
            throw new Error(
              "GenerateDecisionDeck requires an approved UX Spec before technical decisions.",
            );
          }
        }

        const prompt = buildDecisionDeckPrompt({
          kind,
          projectName: project.name,
          productSpec: productSpec.markdown,
          uxSpec: uxSpec?.markdown,
        });
        const cards = validateGeneratedDecisionDeck(
          await runStructuredJsonGeneration({
            templateId: rawJob.type,
            parameters: { kind },
            prompt,
            parse: (content) => {
              const parsed = parseJson<
                Array<{
                  alternatives?: Array<{ description?: string; id?: string; label?: string }>;
                  category?: string;
                  key?: string;
                  prompt?: string;
                  recommendation?: { description?: string; id?: string; label?: string };
                  title?: string;
                }>
              >(content);

              if (!parsed) {
                throw new Error(
                  "GenerateDecisionDeck returned invalid content. Expected a JSON array of decision cards.",
                );
              }

              return parsed;
            },
          }),
        );
        const persistedCards = await input.blueprintService.replaceDecisionDeck({
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          kind,
          cards,
        });

        return input.jobService.markSucceeded(rawJob.id, { createdCount: persistedCards.length, kind });
      }

      case "GenerateProjectBlueprint": {
        const productSpec = await input.productSpecService.getCanonical(ownerUserId, rawJob.projectId);
        const jobInput = parseJobInputs<{ kind?: "tech" | "ux" }>(rawJob.inputs);
        const kind = jobInput?.kind;

        if (!kind) {
          throw new Error("GenerateProjectBlueprint requires a blueprint kind.");
        }

        if (!productSpec?.approvedAt) {
          throw new Error("GenerateProjectBlueprint requires an approved Product Spec.");
        }

        const uxSpec =
          kind === "tech"
            ? await input.blueprintService.getCanonicalByKind(ownerUserId, rawJob.projectId, "ux")
            : null;

        if (kind === "tech") {
          if (!uxSpec) {
            throw new Error("GenerateProjectBlueprint requires an approved UX Spec.");
          }

          const uxApproval = await input.artifactApprovalService.getApproval(
            rawJob.projectId,
            "blueprint_ux",
            uxSpec.id,
          );

          if (!uxApproval) {
            throw new Error("GenerateProjectBlueprint requires an approved UX Spec.");
          }
        }

        await input.blueprintService.assertAcceptedDecisionDeck(ownerUserId, rawJob.projectId, kind);
        let serializedSelections = JSON.stringify(
          await input.blueprintService.getDecisionSelections(ownerUserId, rawJob.projectId, kind),
          null,
          2,
        );
        let consistencyResult: ReturnType<typeof parseDecisionValidationResult> = {
          ok: false,
          issues: [],
        };

        for (let attempt = 0; attempt < 3; attempt++) {
          consistencyResult = await runStructuredJsonGeneration({
            templateId: "ValidateDecisionConsistency",
            parameters: { kind, attempt },
            prompt: buildDecisionConsistencyPrompt({
              kind,
              projectName: project.name,
              productSpec: productSpec.markdown,
              decisions: serializedSelections,
              uxSpec: uxSpec?.markdown,
            }),
            parse: (content) => parseDecisionValidationResult(content),
          });

          if (consistencyResult.ok) {
            break;
          }

          if (attempt === 2) {
            throw createJobFailure({
              message:
                `ValidateDecisionConsistency found conflicts: ${(consistencyResult.issues ?? []).join("; ") || "unknown issue"}`,
              code: "decision_conflict_unresolved",
              category: "semantic_schema_violation",
              templateId: "ValidateDecisionConsistency",
              retryable: true,
            });
          }

          await repairDecisionSelections({
            issues: consistencyResult.issues ?? [],
            kind,
            productSpec: productSpec.markdown,
            uxSpec: uxSpec?.markdown,
          });
          serializedSelections = JSON.stringify(
            await input.blueprintService.getDecisionSelections(ownerUserId, projectId, kind),
            null,
            2,
          );
        }

        const prompt = buildProjectBlueprintPrompt({
          kind,
          projectName: project.name,
          productSpec: productSpec.markdown,
          decisions: serializedSelections,
          uxSpec: uxSpec?.markdown,
        });
        const blueprintPayload = await runStructuredJsonGeneration({
          templateId: rawJob.type,
          parameters: { kind },
          prompt,
          parse: parseBlueprintResult,
        });
        const blueprint = await input.blueprintService.createBlueprintVersion({
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          kind,
          title: blueprintPayload.title,
          markdown: blueprintPayload.markdown,
          source: rawJob.type,
        });

        return input.jobService.markSucceeded(rawJob.id, {
          blueprintId: blueprint.id,
          kind,
        });
      }

      case "GenerateMilestones": {
        if (!input.milestoneService) {
          throw new Error("GenerateMilestones requires milestone service support.");
        }

        const userFlows = await input.userFlowService.list(ownerUserId, rawJob.projectId);
        const blueprints = await input.blueprintService.getCanonical(ownerUserId, rawJob.projectId);

        if (!userFlows.approvedAt) {
          throw new Error("GenerateMilestones requires approved user flows.");
        }

        if (!blueprints.uxBlueprint || !blueprints.techBlueprint) {
          throw new Error("GenerateMilestones requires approved UX and Technical Specs.");
        }

        const [uxApproval, techApproval] = await Promise.all([
          input.artifactApprovalService.getApproval(
            rawJob.projectId,
            "blueprint_ux",
            blueprints.uxBlueprint.id,
          ),
          input.artifactApprovalService.getApproval(
            rawJob.projectId,
            "blueprint_tech",
            blueprints.techBlueprint.id,
          ),
        ]);

        if (!uxApproval || !techApproval) {
          throw new Error("GenerateMilestones requires approved UX and Technical Specs.");
        }

        const generateMilestonesInput = parseJobInputs<{ hint?: string }>(rawJob.inputs);
        const milestonesQuestionnaire = await input.questionnaireService.getAnswers(rawJob.projectId);
        const prompt = buildMilestonePlanPrompt({
          projectName: project.name,
          uxSpec: blueprints.uxBlueprint.markdown,
          technicalSpec: blueprints.techBlueprint.markdown,
          userFlows: userFlows.userFlows.map((flow) => ({
            id: flow.id,
            title: flow.title,
            userStory: flow.userStory,
            entryPoint: flow.entryPoint,
            endState: flow.endState,
          })),
          sizeProfile: classifyProjectSize(milestonesQuestionnaire.answers),
          hint: generateMilestonesInput?.hint,
        });
        const milestones = await runStructuredJsonGeneration({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          parse: (content, templateId) =>
            validateGeneratedMilestones(parseMilestonesResult(content, templateId)),
        });
        await input.milestoneService.replaceDraftMilestoneMap({
          ownerUserId,
          projectId: rawJob.projectId,
          items: milestones,
          createdByJobId: rawJob.id,
        });

        return input.jobService.markSucceeded(rawJob.id, { createdCount: milestones.length });
      }

      case "AppendMilestones": {
        if (!input.milestoneService) {
          throw new Error("AppendMilestones requires milestone service support.");
        }

        const userFlows = await input.userFlowService.list(ownerUserId, rawJob.projectId);
        const blueprints = await input.blueprintService.getCanonical(ownerUserId, rawJob.projectId);
        const milestones = await input.milestoneService.list(ownerUserId, rawJob.projectId);

        if (!userFlows.approvedAt) {
          throw new Error("AppendMilestones requires approved user flows.");
        }

        if (!blueprints.uxBlueprint || !blueprints.techBlueprint) {
          throw new Error("AppendMilestones requires approved UX and Technical Specs.");
        }

        const [uxApproval, techApproval] = await Promise.all([
          input.artifactApprovalService.getApproval(
            rawJob.projectId,
            "blueprint_ux",
            blueprints.uxBlueprint.id,
          ),
          input.artifactApprovalService.getApproval(
            rawJob.projectId,
            "blueprint_tech",
            blueprints.techBlueprint.id,
          ),
        ]);

        if (!uxApproval || !techApproval) {
          throw new Error("AppendMilestones requires approved UX and Technical Specs.");
        }

        const uncoveredFlowSet = new Set(milestones.coverage.uncoveredUserFlowIds);
        const uncoveredFlows = userFlows.userFlows.filter((flow) => uncoveredFlowSet.has(flow.id));

        if (uncoveredFlows.length === 0) {
          return input.jobService.markSucceeded(rawJob.id, { createdCount: 0 });
        }

        const appendMilestonesInput = parseJobInputs<{ hint?: string }>(rawJob.inputs);
        const prompt = buildAppendMilestonePlanPrompt({
          projectName: project.name,
          uxSpec: blueprints.uxBlueprint.markdown,
          technicalSpec: blueprints.techBlueprint.markdown,
          existingMilestones: milestones.milestones.map((milestone) => ({
            title: milestone.title,
            summary: milestone.summary,
            featureCount: milestone.featureCount,
          })),
          uncoveredUserFlows: uncoveredFlows.map((flow) => ({
            id: flow.id,
            title: flow.title,
            userStory: flow.userStory,
            entryPoint: flow.entryPoint,
            endState: flow.endState,
          })),
          hint: appendMilestonesInput?.hint,
        });
        const appendedMilestones = await runStructuredJsonGeneration({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          parse: (content, templateId) =>
            validateGeneratedMilestones(parseMilestonesResult(content, templateId)),
        });
        await input.milestoneService.appendDraftMilestones({
          ownerUserId,
          projectId: rawJob.projectId,
          items: appendedMilestones,
          createdByJobId: rawJob.id,
        });

        return input.jobService.markSucceeded(rawJob.id, {
          createdCount: appendedMilestones.length,
        });
      }

      case "ReviewMilestoneMap": {
        if (!input.milestoneService) {
          throw new Error("ReviewMilestoneMap requires milestone service support.");
        }

        const [productSpec, userFlows, milestones] = await Promise.all([
          input.productSpecService.getCanonical(ownerUserId, rawJob.projectId),
          input.userFlowService.list(ownerUserId, rawJob.projectId),
          input.milestoneService.list(ownerUserId, rawJob.projectId),
        ]);
        const uncoveredFlowSet = new Set(milestones.coverage.uncoveredUserFlowIds);
        const uncoveredFlows = userFlows.userFlows.filter((flow) => uncoveredFlowSet.has(flow.id));

        if (uncoveredFlows.length > 0) {
          const state = await input.milestoneService.getMilestoneMapMutationState(rawJob.projectId);
          const repairAction = state.replacementLocked ? "append_milestones" : "rewrite_milestone_map";

          return input.jobService.markSucceeded(rawJob.id, {
            complete: false,
            issues: [
              {
                action: repairAction,
                hint: buildUncoveredMilestoneFlowHint(uncoveredFlows),
              },
            ],
          });
        }

        const prompt = buildDeliveryReviewPrompt({
          projectName: project.name,
          productSpec: productSpec?.markdown ?? "",
          userFlows: userFlows.userFlows.map((flow) => ({
            title: flow.title,
            userStory: flow.userStory,
          })),
          coverage: {
            approvedUserFlowCount: milestones.coverage.approvedUserFlowCount,
            coveredUserFlowCount: milestones.coverage.coveredUserFlowCount,
            uncoveredUserFlowTitles: [],
          },
          milestones: milestones.milestones.map((milestone) => ({
            title: milestone.title,
            summary: milestone.summary,
            featureCount: milestone.featureCount,
          })),
        });

        const generated = await generateWithJobFailure(prompt, {
          responseFormat: "json",
          templateId: rawJob.type,
        });
        await storeLlmRun({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          generated,
        });

        const review = await parseStructuredJsonWithRepair({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          generated,
          parse: parseMilestoneMapReviewResult,
        });

        return input.jobService.markSucceeded(rawJob.id, {
          complete: review.complete,
          issues: review.issues,
        });
      }

      case "RewriteMilestoneMap": {
        if (!input.milestoneService) {
          throw new Error("RewriteMilestoneMap requires milestone service support.");
        }

        const repairInput = parseJson<{
          issues?: Array<{ action?: string; hint?: string }>;
          attemptNumber?: number;
        }>(JSON.stringify(rawJob.inputs));
        const repairHints = (repairInput?.issues ?? [])
          .filter(
            (issue): issue is { action: "rewrite_milestone_map" | "needs_human_review"; hint: string } =>
              (issue.action === "rewrite_milestone_map" || issue.action === "needs_human_review") &&
              typeof issue.hint === "string" &&
              issue.hint.trim().length > 0,
          )
          .map((issue) => issue.hint.trim());
        const hint = [
          repairInput?.attemptNumber ? `Repair attempt ${repairInput.attemptNumber}.` : null,
          ...repairHints,
        ]
          .filter((value): value is string => Boolean(value))
          .join("\n");
        const userFlows = await input.userFlowService.list(ownerUserId, rawJob.projectId);
        const blueprints = await input.blueprintService.getCanonical(ownerUserId, rawJob.projectId);

        if (!userFlows.approvedAt) {
          throw new Error("RewriteMilestoneMap requires approved user flows.");
        }

        if (!blueprints.uxBlueprint || !blueprints.techBlueprint) {
          throw new Error("RewriteMilestoneMap requires approved UX and Technical Specs.");
        }

        const prompt = buildMilestonePlanPrompt({
          projectName: project.name,
          uxSpec: blueprints.uxBlueprint.markdown,
          technicalSpec: blueprints.techBlueprint.markdown,
          userFlows: userFlows.userFlows.map((flow) => ({
            id: flow.id,
            title: flow.title,
            userStory: flow.userStory,
            entryPoint: flow.entryPoint,
            endState: flow.endState,
          })),
          hint: hint.length > 0 ? hint : undefined,
        });
        const milestones = await runStructuredJsonGeneration({
          templateId: rawJob.type,
          parameters: { hint },
          prompt,
          parse: (content, templateId) =>
            validateGeneratedMilestones(parseMilestonesResult(content, templateId)),
        });
        await input.milestoneService.replaceDraftMilestoneMap({
          ownerUserId,
          projectId: rawJob.projectId,
          items: milestones,
          createdByJobId: rawJob.id,
        });

        return input.jobService.markSucceeded(rawJob.id, { createdCount: milestones.length });
      }

      case "GenerateMilestoneDesign": {
        if (!input.milestoneService) {
          throw new Error("GenerateMilestoneDesign requires milestone service support.");
        }

        const jobInput = parseJobInputs<{ hint?: string; milestoneId?: string }>(rawJob.inputs);
        const milestoneId = jobInput?.milestoneId;

        if (!milestoneId) {
          throw new Error("GenerateMilestoneDesign requires a milestoneId.");
        }

        await input.milestoneService.assertActiveMilestone(
          ownerUserId,
          rawJob.projectId,
          milestoneId,
        );
        const milestone = await input.milestoneService.getContext(ownerUserId, milestoneId);
        if (milestone.status !== "draft") {
          throw new Error("GenerateMilestoneDesign only runs for milestones that are not approved yet.");
        }

        const [blueprints, milestoneRecord, linkedFlows] = await Promise.all([
          input.blueprintService.getCanonical(ownerUserId, rawJob.projectId),
          getScopedMilestone(milestoneId),
          input.db
            .select({
              title: useCasesTable.title,
              userStory: useCasesTable.userStory,
              entryPoint: useCasesTable.entryPoint,
              endState: useCasesTable.endState,
            })
            .from(milestoneUseCasesTable)
            .innerJoin(useCasesTable, eq(useCasesTable.id, milestoneUseCasesTable.useCaseId))
            .where(eq(milestoneUseCasesTable.milestoneId, milestoneId)),
        ]);

        if (!milestoneRecord) {
          throw new Error("GenerateMilestoneDesign could not load the milestone.");
        }

        if (!blueprints.uxBlueprint || !blueprints.techBlueprint) {
          throw new Error("GenerateMilestoneDesign requires approved UX and Technical Specs.");
        }
        const uxBlueprint = blueprints.uxBlueprint;
        const techBlueprint = blueprints.techBlueprint;

        const parseMilestoneDesignCoreWithShapeRepair = async (inputArgs: {
          contractGuidance?: string[];
          generated: Awaited<ReturnType<LlmProviderService["generate"]>>;
          hint?: string;
          parameters: Record<string, unknown>;
          templateId: string;
        }) => {
          try {
            return parseMilestoneDesignDraft(inputArgs.generated.content, inputArgs.templateId, {
              allowEmptyIncludedUserFlows: linkedFlows.length === 0,
            });
          } catch (error) {
            const validationMessage =
              error instanceof Error
                ? error.message
                : `${inputArgs.templateId} returned invalid content.`;

            if (inputArgs.generated.doneReason === "length") {
              throw createStructuredOutputFailure({
                message: validationMessage,
                templateId: inputArgs.templateId,
                doneReason: inputArgs.generated.doneReason,
              });
            }

            const jsonRepairTemplateId = `${inputArgs.templateId}Repair`;
            const jsonRepairPrompt = buildJsonRepairPrompt({
              contractGuidance: inputArgs.contractGuidance,
              templateId: inputArgs.templateId,
              validationMessage,
              invalidResponse: inputArgs.generated.content,
            });
            const jsonRepaired = await generateWithJobFailure(jsonRepairPrompt, {
              responseFormat: "json",
              templateId: jsonRepairTemplateId,
            });
            await storeLlmRun({
              templateId: jsonRepairTemplateId,
              parameters: {
                ...inputArgs.parameters,
                repairOf: inputArgs.templateId,
              },
              prompt: jsonRepairPrompt,
              generated: jsonRepaired,
            });

            try {
              return parseMilestoneDesignDraft(jsonRepaired.content, inputArgs.templateId, {
                allowEmptyIncludedUserFlows: linkedFlows.length === 0,
              });
            } catch (jsonRepairError) {
              const shapeRepairMessage =
                jsonRepairError instanceof Error ? jsonRepairError.message : validationMessage;
              const shapeRepairTemplateId = `${inputArgs.templateId}ShapeRetry`;
              const shapeRepairPrompt = buildMilestoneDesignRepairPrompt({
                projectName: project.name,
                milestoneTitle: milestoneRecord.title,
                milestoneSummary: milestoneRecord.summary,
                linkedUserFlows: linkedFlows,
                uxSpec: uxBlueprint.markdown,
                technicalSpec: techBlueprint.markdown,
                issues: [shapeRepairMessage],
                draftJson: jsonRepaired.content,
                hint: inputArgs.hint?.trim() || shapeRepairMessage,
              });
              const shapeRepaired = await generateWithJobFailure(shapeRepairPrompt, {
                responseFormat: "json",
                templateId: shapeRepairTemplateId,
              });
              await storeLlmRun({
                templateId: shapeRepairTemplateId,
                parameters: {
                  ...inputArgs.parameters,
                  repairOf: inputArgs.templateId,
                  repairKind: "shape",
                },
                prompt: shapeRepairPrompt,
                generated: shapeRepaired,
              });

              try {
                return parseMilestoneDesignDraft(shapeRepaired.content, inputArgs.templateId, {
                  allowEmptyIncludedUserFlows: linkedFlows.length === 0,
                });
              } catch (shapeRepairError) {
                throw createStructuredOutputFailure({
                  message:
                    shapeRepairError instanceof Error
                      ? shapeRepairError.message
                      : shapeRepairMessage,
                  templateId: inputArgs.templateId,
                  doneReason:
                    shapeRepaired.doneReason ??
                    jsonRepaired.doneReason ??
                    inputArgs.generated.doneReason ??
                    null,
                });
              }
            }
          }
        };

        const generateMilestoneDesignCoreDraft = async (inputArgs: {
          hint?: string;
          templateId: string;
        }) => {
          const prompt = buildMilestoneDesignPrompt({
            projectName: project.name,
            milestoneTitle: milestoneRecord.title,
            milestoneSummary: milestoneRecord.summary,
            linkedUserFlows: linkedFlows,
            uxSpec: uxBlueprint.markdown,
            technicalSpec: techBlueprint.markdown,
            hint: inputArgs.hint,
          });

          const generated = await generateWithJobFailure(prompt, {
            responseFormat: "json",
            templateId: inputArgs.templateId,
          });
          await storeLlmRun({
            templateId: inputArgs.templateId,
            parameters: { milestoneId },
            prompt,
            generated,
          });
          return parseMilestoneDesignCoreWithShapeRepair({
            contractGuidance: [
              'Top-level keys must be exactly "title", "objective", "includedUserFlows", "scopeBoundaries", "deliveryGroups", "dependenciesAndSequencing", and "exitCriteria".',
              "dependenciesAndSequencing items must use phase, deliveryGroupKeys, and notes.",
              'Use a string phase label such as "Phase 1".',
              "deliveryGroupKeys must always be an array.",
            ],
            generated,
            hint: inputArgs.hint,
            parameters: { milestoneId },
            templateId: inputArgs.templateId,
          });
        };

        const repairMilestoneDesignCoreDraft = async (inputArgs: {
          draft: ParsedMilestoneDesignDraft;
          hint?: string;
          issues: string[];
          templateId: string;
        }) => {
          const prompt = buildMilestoneDesignRepairPrompt({
            projectName: project.name,
            milestoneTitle: milestoneRecord.title,
            milestoneSummary: milestoneRecord.summary,
            linkedUserFlows: linkedFlows,
            uxSpec: uxBlueprint.markdown,
            technicalSpec: techBlueprint.markdown,
            issues: inputArgs.issues,
            draftJson: JSON.stringify(inputArgs.draft, null, 2),
            hint: inputArgs.hint,
          });
          const generated = await generateWithJobFailure(prompt, {
            responseFormat: "json",
            templateId: inputArgs.templateId,
          });
          await storeLlmRun({
            templateId: inputArgs.templateId,
            parameters: { milestoneId },
            prompt,
            generated,
          });
          return parseMilestoneDesignCoreWithShapeRepair({
            contractGuidance: [
              'Top-level keys must be exactly "title", "objective", "includedUserFlows", "scopeBoundaries", "deliveryGroups", "dependenciesAndSequencing", and "exitCriteria".',
              "dependenciesAndSequencing items must use phase, deliveryGroupKeys, and notes.",
              'Use a string phase label such as "Phase 1".',
              "deliveryGroupKeys must always be an array.",
            ],
            generated,
            hint: inputArgs.hint,
            parameters: { milestoneId },
            templateId: inputArgs.templateId,
          });
        };

        let designDraft = await generateMilestoneDesignCoreDraft({
          hint: jobInput?.hint,
          templateId: rawJob.type,
        });
        let designValidation = validateMilestoneDesignDraft(designDraft, linkedFlows);

        if (!designValidation.ok) {
          designDraft = await repairMilestoneDesignCoreDraft({
            draft: designDraft,
            issues: designValidation.issues,
            hint: designValidation.hint.length > 0
              ? designValidation.hint
              : designValidation.issues.join(" "),
            templateId: `${rawJob.type}ConsistencyRetry`,
          });
          designValidation = validateMilestoneDesignDraft(designDraft, linkedFlows);
        }

        if (!designValidation.ok) {
          throw createJobFailure({
            message:
              `Milestone design validation found unresolved conflicts: ${designValidation.issues.join("; ") || "unknown issue"}`,
            code: "milestone_design_conflict_unresolved",
            hint: designValidation.hint.length > 0 ? designValidation.hint : designValidation.issues[0],
            retryable: true,
          });
        }

        const designDoc = {
          title: designDraft.title,
          markdown: renderMilestoneDesignMarkdown(designDraft),
        };

        const created = await input.milestoneService.createDesignDocVersion({
          milestoneId,
          title: designDoc.title,
          markdown: designDoc.markdown,
          source: rawJob.type,
          createdByJobId: rawJob.id,
        });

        return input.jobService.markSucceeded(rawJob.id, { designDocId: created.id });
      }

      case "ReviewMilestoneScope":
      case "ReviewMilestoneCoverage": {
        if (!input.milestoneService || !input.featureService || !input.featureWorkstreamService) {
          throw new Error("ReviewMilestoneCoverage requires milestone and feature support.");
        }

        const jobInput = parseJobInputs<{ milestoneId?: string }>(rawJob.inputs);
        const milestoneId = jobInput?.milestoneId;
        if (!milestoneId) {
          throw new Error("ReviewMilestoneCoverage requires a milestoneId.");
        }

        await input.milestoneService.assertActiveMilestone(ownerUserId, rawJob.projectId, milestoneId);
        const milestone = await getScopedMilestone(milestoneId);
        const milestoneDesignDoc = await input.milestoneService.getCanonicalDesignDoc(
          ownerUserId,
          milestoneId,
        );

        if (!milestone || !milestoneDesignDoc) {
          throw new Error("ReviewMilestoneCoverage requires a canonical milestone design document.");
        }

        const { features } = await input.featureService.list(ownerUserId, rawJob.projectId);
        const milestoneFeatures = features.filter((feature) => feature.milestoneId === milestoneId);
        const taskPlanning = createTaskPlanningService(input.db, input.milestoneService);

        const featurePayload = await Promise.all(
          milestoneFeatures.map(async (feature) => {
            const tracks = await input.featureWorkstreamService!.getTracks(ownerUserId, feature.id);
            const session = await taskPlanning.getSession(ownerUserId, feature.id);
            const tasks = session ? await taskPlanning.getTasks(ownerUserId, session.id) : [];
            return {
              featureKey: feature.featureKey,
              title: feature.headRevision.title,
              summary: feature.headRevision.summary,
              acceptanceCriteria: Array.isArray(feature.headRevision.acceptanceCriteria)
                ? feature.headRevision.acceptanceCriteria.filter(
                    (item): item is string => typeof item === "string",
                  )
                : [],
              workstreams: {
                product: tracks.tracks.product.status,
                ux: tracks.tracks.ux.status,
                tech: tracks.tracks.tech.status,
                userDocs: tracks.tracks.userDocs.status,
                archDocs: tracks.tracks.archDocs.status,
              },
              taskCount: tasks.length,
              taskTitles: tasks.map(
                (task: Awaited<ReturnType<typeof taskPlanning.getTasks>>[number]) => task.title,
              ),
            };
          }),
        );

        const prompt = buildMilestoneCoverageReviewPrompt({
          milestone: {
            title: milestone.title,
            summary: milestone.summary,
          },
          milestoneDesignDoc: milestoneDesignDoc.markdown,
          features: featurePayload,
        });
        const generated = await generateWithJobFailure(prompt, {
          responseFormat: "json",
          templateId: rawJob.type,
        });
        await storeLlmRun({
          templateId: rawJob.type,
          parameters: { milestoneId },
          prompt,
          generated,
        });

        const review = await parseStructuredJsonWithRepair({
          templateId: rawJob.type,
          parameters: { milestoneId },
          prompt,
          generated,
          parse: parseMilestoneCoverageReviewResult,
        });
        return input.jobService.markSucceeded(rawJob.id, {
          milestoneId,
          complete: review.complete,
          issues: review.issues,
        });
      }

      case "GenerateMilestoneFeatureSet": {
        if (!input.featureService || !input.milestoneService) {
          throw new Error("GenerateMilestoneFeatureSet requires feature and milestone support.");
        }

        const jobInput = parseJobInputs<{ milestoneId?: string }>(rawJob.inputs);
        const milestoneId = jobInput?.milestoneId;

        if (!milestoneId) {
          throw new Error("GenerateMilestoneFeatureSet requires a milestoneId.");
        }

        await input.featureService.assertApprovedMilestone(rawJob.projectId, milestoneId);
        const overview = await input.onePagerService.getCanonical(ownerUserId, rawJob.projectId);
        if (!overview?.approvedAt) {
          throw new Error("GenerateMilestoneFeatureSet requires an approved overview document.");
        }

        const [features, milestoneRecord, milestoneList, milestoneDesignDoc, projectSpecs, userFlows] =
          await Promise.all([
          input.featureService.list(ownerUserId, rawJob.projectId),
          getScopedMilestone(milestoneId),
          input.milestoneService.list(ownerUserId, rawJob.projectId),
          input.milestoneService.getCanonicalDesignDoc(ownerUserId, milestoneId),
          loadApprovedProjectSpecs(),
          input.userFlowService.list(ownerUserId, rawJob.projectId),
        ]);

        if (!milestoneRecord) {
          throw new Error("GenerateMilestoneFeatureSet could not load the target milestone.");
        }

        if (!milestoneDesignDoc) {
          throw new Error(
            "GenerateMilestoneFeatureSet requires a canonical milestone design document.",
          );
        }

        if (!userFlows.approvedAt) {
          throw new Error("GenerateMilestoneFeatureSet requires approved user flows.");
        }

        const featureTitleById = new Map(
          features.features.map((feature) => [feature.id, feature.headRevision.title]),
        );
        const selectedMilestone =
          milestoneList.milestones.find((item) => item.id === milestoneId) ?? null;

        const featureSetQuestionnaire = await input.questionnaireService.getAnswers(rawJob.projectId);
        const prompt = buildMilestoneFeatureSetPrompt({
          existingFeatures: features.features.map((feature) => ({
            dependencies: feature.dependencyIds.map(
              (dependencyId) => featureTitleById.get(dependencyId) ?? dependencyId,
            ),
            milestoneTitle: feature.milestoneTitle,
            summary: feature.headRevision.summary,
            title: feature.headRevision.title,
          })),
          milestone: {
            title: milestoneRecord.title,
            summary: milestoneRecord.summary,
          },
          milestoneDesignDoc: milestoneDesignDoc.markdown,
          milestones: milestoneList.milestones.map((milestone) => ({
            title: milestone.title,
            summary: milestone.summary,
          })),
          projectName: project.name,
          overviewDocument: overview.markdown,
          projectProductSpec: projectSpecs.productSpec.markdown,
          projectTechnicalSpec: projectSpecs.technicalSpec.markdown,
          projectUxSpec: projectSpecs.uxSpec.markdown,
          linkedUserFlows: (selectedMilestone?.linkedUserFlows ?? []).map((flow) => ({
            id: flow.id,
            title: flow.title,
          })),
          sizeProfile: classifyProjectSize(featureSetQuestionnaire.answers),
        });
        const items = await runReviewedJsonGeneration({
          templateId: rawJob.type,
          parameters: { milestoneId },
          prompt,
          parseDraft: (content, templateId) => {
            const parsed = parseGeneratedFeaturesResult(content);

            if (!parsed) {
              throw new Error(
                `${templateId} returned invalid content. Expected a JSON array of features.`,
              );
            }

            return validateGeneratedFeatures(parsed, templateId);
          },
          buildReviewPrompt: (draftFeatures) =>
            buildMilestoneFeatureSetReviewPrompt({
              projectName: project.name,
              milestone: {
                title: milestoneRecord.title,
                summary: milestoneRecord.summary,
              },
              milestoneDesignDoc: milestoneDesignDoc.markdown,
              linkedUserFlows: (selectedMilestone?.linkedUserFlows ?? []).map((flow) => ({
                id: flow.id,
                title: flow.title,
              })),
              existingFeatures: features.features.map((feature) => ({
                dependencies: feature.dependencyIds.map(
                  (dependencyId) => featureTitleById.get(dependencyId) ?? dependencyId,
                ),
                milestoneTitle: feature.milestoneTitle,
                summary: feature.headRevision.summary,
                title: feature.headRevision.title,
              })),
              draftFeatures,
            }),
        });
        const appended = await input.featureService.appendGeneratedFeatures({
          ownerUserId,
          projectId: rawJob.projectId,
          milestoneId,
          createdByJobId: rawJob.id,
          items,
        });

        return input.jobService.markSucceeded(rawJob.id, {
          createdCount: appended.createdIds.length,
          skippedCount: appended.skippedCount,
          featureIds: appended.createdIds,
        });
      }

      case "RewriteMilestoneFeatureSet": {
        if (!input.featureService || !input.milestoneService) {
          throw new Error("RewriteMilestoneFeatureSet requires milestone and feature support.");
        }

        const jobInput = parseJson<{
          issues?: Array<{ action?: string; hint?: string }>;
          milestoneId?: string;
          attemptNumber?: number;
        }>(
          JSON.stringify(rawJob.inputs),
        );
        const milestoneId = jobInput?.milestoneId;
        if (!milestoneId) {
          throw new Error("RewriteMilestoneFeatureSet requires a milestoneId.");
        }

        await input.milestoneService.assertActiveMilestone(ownerUserId, rawJob.projectId, milestoneId);
        await input.featureService.assertApprovedMilestone(rawJob.projectId, milestoneId);

        const overview = await input.onePagerService.getCanonical(ownerUserId, rawJob.projectId);
        if (!overview?.approvedAt) {
          throw new Error("RewriteMilestoneFeatureSet requires an approved overview document.");
        }

        const [projectSpecs, milestoneRecord, milestoneDesignDoc, featureList, milestoneList] = await Promise.all([
          loadApprovedProjectSpecs(),
          getScopedMilestone(milestoneId),
          input.milestoneService.getCanonicalDesignDoc(ownerUserId, milestoneId),
          input.featureService.list(ownerUserId, rawJob.projectId),
          input.milestoneService.list(ownerUserId, rawJob.projectId),
        ]);

        if (!milestoneRecord || !milestoneDesignDoc) {
          throw new Error(
            "RewriteMilestoneFeatureSet requires a canonical milestone design document.",
          );
        }

        const featureTitleById = new Map(
          featureList.features.map((feature) => [feature.id, feature.headRevision.title]),
        );
        const selectedMilestone =
          milestoneList.milestones.find((milestone) => milestone.id === milestoneId) ?? null;
        const currentMilestoneFeatures = featureList.features
          .filter((feature) => feature.milestoneId === milestoneId)
          .map((feature) => ({
            title: feature.headRevision.title,
            summary: feature.headRevision.summary,
          }));
        const issues = parseMilestoneCoverageIssuesInput(jobInput?.issues);
        const rewriteIssues = issues.length > 0
          ? issues
          : [
              {
                action: "rewrite_feature_set" as const,
                hint: "Rewrite the feature set to close the missing milestone coverage.",
              },
            ];
        const attemptNumber = jobInput?.attemptNumber ?? 1;

        const prompt = buildRewriteMilestoneFeatureSetPrompt({
          issues: rewriteIssues,
          attemptNumber,
          linkedUserFlows: (selectedMilestone?.linkedUserFlows ?? []).map((flow) => ({
            id: flow.id,
            title: flow.title,
          })),
          milestone: {
            title: milestoneRecord.title,
            summary: milestoneRecord.summary,
          },
          milestoneDesignDoc: milestoneDesignDoc.markdown,
          currentMilestoneFeatures,
          existingFeatures: featureList.features.map((feature) => ({
            dependencies: feature.dependencyIds.map(
              (dependencyId) => featureTitleById.get(dependencyId) ?? dependencyId,
            ),
            milestoneTitle: feature.milestoneTitle,
            summary: feature.headRevision.summary,
            title: feature.headRevision.title,
          })),
          overviewDocument: overview.markdown,
          projectName: project.name,
          projectProductSpec: projectSpecs.productSpec.markdown,
          projectTechnicalSpec: projectSpecs.technicalSpec.markdown,
          projectUxSpec: projectSpecs.uxSpec.markdown,
        });
        const rewrittenFeatures = await runReviewedJsonGeneration({
          templateId: rawJob.type,
          parameters: { milestoneId },
          prompt,
          parseDraft: (content, templateId) => {
            const parsed = parseGeneratedFeaturesResult(content);

            if (!parsed) {
              throw new Error(
                `${templateId} returned invalid content. Expected a JSON array of features.`,
              );
            }

            return validateGeneratedFeatures(parsed, templateId);
          },
          buildReviewPrompt: (draftFeatures) =>
            buildRewriteMilestoneFeatureSetReviewPrompt({
              issues: rewriteIssues,
              attemptNumber,
              linkedUserFlows: (selectedMilestone?.linkedUserFlows ?? []).map((flow) => ({
                id: flow.id,
                title: flow.title,
              })),
              milestone: {
                title: milestoneRecord.title,
                summary: milestoneRecord.summary,
              },
              milestoneDesignDoc: milestoneDesignDoc.markdown,
              currentMilestoneFeatures,
              existingFeatures: featureList.features.map((feature) => ({
                dependencies: feature.dependencyIds.map(
                  (dependencyId) => featureTitleById.get(dependencyId) ?? dependencyId,
                ),
                milestoneTitle: feature.milestoneTitle,
                summary: feature.headRevision.summary,
                title: feature.headRevision.title,
              })),
              draftFeatures,
            }),
        });
        const rewritten = await input.featureService.replaceGeneratedMilestoneFeatures({
          ownerUserId,
          projectId: rawJob.projectId,
          milestoneId,
          createdByJobId: rawJob.id,
          items: rewrittenFeatures,
        });

        return input.jobService.markSucceeded(rawJob.id, {
          archivedCount: rewritten.archivedCount,
          createdCount: rewritten.createdIds.length,
          featureIds: rewritten.createdIds,
          milestoneId,
        });
      }

      case "ReviewMilestoneDelivery": {
        if (
          !input.featureService ||
          !input.featureWorkstreamService ||
          !input.milestoneService ||
          !taskPlanning
        ) {
          throw new Error(
            "ReviewMilestoneDelivery requires milestone, feature, workstream, and task planning support.",
          );
        }

        const jobInput = parseJobInputs<{ milestoneId?: string }>(rawJob.inputs);
        const milestoneId = jobInput?.milestoneId;
        if (!milestoneId) {
          throw new Error("ReviewMilestoneDelivery requires a milestoneId.");
        }

        await input.milestoneService.assertActiveMilestone(ownerUserId, rawJob.projectId, milestoneId);
        const milestone = await getScopedMilestone(milestoneId);
        const milestoneDesignDoc = await input.milestoneService.getCanonicalDesignDoc(
          ownerUserId,
          milestoneId,
        );

        if (!milestone || !milestoneDesignDoc) {
          throw new Error(
            "ReviewMilestoneDelivery requires a canonical milestone design document.",
          );
        }

        const { features } = await input.featureService.list(ownerUserId, rawJob.projectId);
        const milestoneFeatures = features.filter((feature) => feature.milestoneId === milestoneId);
        const featurePayload = await Promise.all(
          milestoneFeatures.map(async (feature) => {
            const tracks = await input.featureWorkstreamService!.getTracks(ownerUserId, feature.id);
            const session = await taskPlanning.getSession(ownerUserId, feature.id);
            const tasks = session ? await taskPlanning.getTasks(ownerUserId, session.id) : [];
            return {
              featureKey: feature.featureKey,
              title: feature.headRevision.title,
              summary: feature.headRevision.summary,
              acceptanceCriteria: Array.isArray(feature.headRevision.acceptanceCriteria)
                ? feature.headRevision.acceptanceCriteria.filter(
                    (item): item is string => typeof item === "string",
                  )
                : [],
              workstreams: {
                product: tracks.tracks.product.status,
                ux: tracks.tracks.ux.status,
                tech: tracks.tracks.tech.status,
                userDocs: tracks.tracks.userDocs.status,
                archDocs: tracks.tracks.archDocs.status,
              },
              taskCount: tasks.length,
              taskTitles: tasks.map((task) => task.title),
            };
          }),
        );

        const prompt = buildMilestoneCoverageReviewPrompt({
          milestone: {
            title: milestone.title,
            summary: milestone.summary,
          },
          milestoneDesignDoc: milestoneDesignDoc.markdown,
          features: featurePayload,
        });
        const generated = await generateWithJobFailure(prompt, {
          responseFormat: "json",
          templateId: rawJob.type,
        });
        await storeLlmRun({
          templateId: rawJob.type,
          parameters: { milestoneId },
          prompt,
          generated,
        });

        const review = await parseStructuredJsonWithRepair({
          templateId: rawJob.type,
          parameters: { milestoneId },
          prompt,
          generated,
          parse: parseMilestoneDeliveryReviewResult,
        });
        return input.jobService.markSucceeded(rawJob.id, {
          milestoneId,
          complete: review.complete,
          issues: review.issues,
        });
      }

      case "ResolveMilestoneDeliveryIssues":
      case "ResolveMilestoneCoverageIssues": {
        if (
          !input.featureService ||
          !input.featureWorkstreamService ||
          !input.milestoneService ||
          !taskPlanning
        ) {
          throw new Error(
            "ResolveMilestoneCoverageIssues requires milestone, feature, workstream, and task planning support.",
          );
        }

        const jobInput = parseJson<{
          milestoneId?: string;
          issues?: Array<{ action?: string; hint?: string }>;
          attemptNumber?: number;
          previousUnresolvedReasons?: string[];
        }>(JSON.stringify(rawJob.inputs));
        const milestoneId = jobInput?.milestoneId;
        if (!milestoneId) {
          throw new Error("ResolveMilestoneCoverageIssues requires a milestoneId.");
        }

        await input.milestoneService.assertActiveMilestone(ownerUserId, rawJob.projectId, milestoneId);

        const milestone = await getScopedMilestone(milestoneId);
        const milestoneDesignDoc = await input.milestoneService.getCanonicalDesignDoc(
          ownerUserId,
          milestoneId,
        );

        if (!milestone || !milestoneDesignDoc) {
          throw new Error(
            "ResolveMilestoneCoverageIssues requires a canonical milestone design document.",
          );
        }

        const issues = parseMilestoneCoverageIssuesInput(jobInput?.issues).filter(
          (issue): issue is { action: "needs_human_review"; hint: string } =>
            issue.action === "needs_human_review",
        );
        const attemptNumber = jobInput?.attemptNumber ?? 1;
        const previousUnresolvedReasons = (jobInput?.previousUnresolvedReasons ?? []).filter(
          (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
        );

        if (issues.length === 0) {
          return input.jobService.markSucceeded(rawJob.id, {
            resolved: false,
            defaultsChosen: [],
            operationsApplied: [],
            unresolvedReasons: [
              "No needs_human_review reconciliation issues were provided to the repair job.",
            ],
          });
        }

        const { features } = await input.featureService.list(ownerUserId, rawJob.projectId);
        const milestoneFeatures = features.filter((feature) => feature.milestoneId === milestoneId);

        const featurePayload = await Promise.all(
          milestoneFeatures.map(async (feature) => {
            const session = await taskPlanning.getSession(ownerUserId, feature.id);
            const tasks = session ? await taskPlanning.getTasks(ownerUserId, session.id) : [];

            return {
              featureKey: feature.featureKey,
              title: feature.headRevision.title,
              summary: feature.headRevision.summary,
              acceptanceCriteria: feature.headRevision.acceptanceCriteria,
              taskTitles: tasks.map((task) => task.title),
            };
          }),
        );

        const repairPlan = await runReviewedJsonGeneration({
          templateId: rawJob.type,
          parameters: { milestoneId, issueCount: issues.length },
          prompt: buildMilestoneCoverageRepairPrompt({
            issues,
            attemptNumber,
            previousUnresolvedReasons,
            milestone: {
              title: milestone.title,
              summary: milestone.summary,
            },
            milestoneDesignDoc: milestoneDesignDoc.markdown,
            features: featurePayload,
          }),
          parseDraft: parseMilestoneCoverageRepairPlan,
          buildReviewPrompt: (draftPlan) =>
            buildMilestoneCoverageRepairReviewPrompt({
              milestone: {
                title: milestone.title,
                summary: milestone.summary,
              },
              attemptNumber,
              milestoneDesignDoc: milestoneDesignDoc.markdown,
              issues,
              previousUnresolvedReasons,
              draftPlan,
            }),
        });

        if (!repairPlan.resolved || repairPlan.operations.length === 0) {
          return input.jobService.markSucceeded(rawJob.id, {
            resolved: false,
            defaultsChosen: repairPlan.defaultsChosen,
            operationsApplied: [],
            unresolvedReasons:
              repairPlan.unresolvedReasons.length > 0
                ? repairPlan.unresolvedReasons
                : ["The repair planner could not produce an executable repair plan."],
          });
        }

        const featureByKey = new Map(milestoneFeatures.map((feature) => [feature.featureKey, feature]));
        const unknownFeatureKeys = repairPlan.operations
          .map((operation) => operation.featureKey)
          .filter((featureKey) => !featureByKey.has(featureKey));

        if (unknownFeatureKeys.length > 0) {
          return input.jobService.markSucceeded(rawJob.id, {
            resolved: false,
            defaultsChosen: repairPlan.defaultsChosen,
            operationsApplied: [],
            unresolvedReasons: unknownFeatureKeys.map(
              (featureKey) =>
                `Repair planner referenced unknown active-milestone feature "${featureKey}".`,
            ),
          });
        }

        const operationsApplied: Array<{
          featureId: string;
          featureKey: string;
          hint: string;
          featurePatched: boolean;
          refresh: {
            product: boolean;
            ux: boolean;
            tech: boolean;
            userDocs: boolean;
            archDocs: boolean;
            tasks: boolean;
          };
        }> = [];

        for (const operation of repairPlan.operations) {
          const feature = featureByKey.get(operation.featureKey)!;
          const refresh = { ...operation.refresh };

          if (operation.featurePatch) {
            await input.featureService.createRevision(
              ownerUserId,
              feature.id,
              {
                ...operation.featurePatch,
                source: "ResolveMilestoneCoverageIssues",
              },
              rawJob.id,
            );
            refresh.product = true;
          }

          if (refresh.product) {
            await generateFeatureProductRevision(feature.id, operation.hint);
            await approveHeadRevision(feature.id, "product");
          }

          const postProductTracks = await input.featureWorkstreamService.getTracks(
            ownerUserId,
            feature.id,
          );
          const productRequirements = postProductTracks.tracks.product.headRevision?.requirements ?? {
            uxRequired: false,
            techRequired: false,
            userDocsRequired: false,
            archDocsRequired: false,
          };

          refresh.ux = refresh.ux || productRequirements.uxRequired;
          refresh.tech = refresh.tech || productRequirements.techRequired || refresh.tasks;
          refresh.userDocs = refresh.userDocs || productRequirements.userDocsRequired;
          refresh.archDocs = refresh.archDocs || productRequirements.archDocsRequired;

          if (refresh.ux) {
            await generateFeatureWorkstreamRevision(feature.id, "ux", operation.hint);
            await approveHeadRevision(feature.id, "ux");
          }

          if (refresh.tech) {
            await generateFeatureWorkstreamRevision(feature.id, "tech", operation.hint);
            await approveHeadRevision(feature.id, "tech");
          }

          if (refresh.userDocs) {
            await generateFeatureWorkstreamRevision(feature.id, "user_docs", operation.hint);
            await approveHeadRevision(feature.id, "user_docs");
          }

          if (refresh.archDocs) {
            await generateFeatureWorkstreamRevision(feature.id, "arch_docs", operation.hint);
            await approveHeadRevision(feature.id, "arch_docs");
          }

          if (refresh.tasks) {
            await regenerateFeatureTasks(feature.id, operation.hint);
          }

          operationsApplied.push({
            featureId: feature.id,
            featureKey: feature.featureKey,
            hint: operation.hint,
            featurePatched: operation.featurePatch !== null,
            refresh,
          });
        }

        return input.jobService.markSucceeded(rawJob.id, {
          resolved: true,
          defaultsChosen: repairPlan.defaultsChosen,
          operationsApplied,
          unresolvedReasons: [],
        });
      }

      case "GenerateFeatureProductSpec": {
        if (!input.featureWorkstreamService || !input.milestoneService) {
          throw new Error("GenerateFeatureProductSpec requires feature workstream support.");
        }

        const jobInput = parseJobInputs<{ featureId?: string; hint?: string }>(rawJob.inputs);
        const featureId = jobInput?.featureId;

        if (!featureId) {
          throw new Error("GenerateFeatureProductSpec requires a featureId.");
        }

        const { productSpec, uxSpec, technicalSpec } = await loadApprovedProjectSpecs();
        const context = await input.featureWorkstreamService.getFeatureContext(
          ownerUserId,
          featureId,
        );
        const milestoneContext = await loadMilestonePromptContext(
          context.feature.milestoneId,
          featureId,
        );

        const prompt = buildFeatureProductSpecPrompt({
          feature: {
            acceptanceCriteria: Array.isArray(context.headFeatureRevision.acceptanceCriteria)
              ? context.headFeatureRevision.acceptanceCriteria.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
            featureKey: context.feature.featureKey,
            milestoneTitle: milestoneContext.milestone.title,
            summary: context.headFeatureRevision.summary,
            title: context.headFeatureRevision.title,
          },
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          siblingFeatures: milestoneContext.siblingFeatures,
          productSpec: productSpec.markdown,
          technicalSpec: technicalSpec.markdown,
          uxSpec: uxSpec.markdown,
          hint: jobInput?.hint,
        });
        const featureContext = {
          acceptanceCriteria: Array.isArray(context.headFeatureRevision.acceptanceCriteria)
            ? context.headFeatureRevision.acceptanceCriteria.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          featureKey: context.feature.featureKey,
          milestoneTitle: milestoneContext.milestone.title,
          summary: context.headFeatureRevision.summary,
          title: context.headFeatureRevision.title,
        };
        const generatedSpec = await runReviewedJsonGeneration({
          templateId: rawJob.type,
          parameters: { featureId },
          prompt,
          parseDraft: parseFeatureWorkstreamResult,
          buildReviewPrompt: (draft) =>
            buildFeatureProductSpecReviewPrompt({
              feature: featureContext,
              milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
              siblingFeatures: milestoneContext.siblingFeatures,
              draftTitle: draft.title,
              draftMarkdown: draft.markdown,
              requirements:
                draft.requirements ?? {
                  uxRequired: true,
                  techRequired: true,
                  userDocsRequired: true,
                  archDocsRequired: true,
                },
              hint: jobInput?.hint,
            }),
        });
        await input.featureWorkstreamService.createRevision(
          ownerUserId,
          featureId,
          "product",
          {
            markdown: generatedSpec.markdown,
            requirements:
              generatedSpec.requirements ?? {
                uxRequired: true,
                techRequired: true,
                userDocsRequired: true,
                archDocsRequired: true,
              },
            source: rawJob.type,
            title: generatedSpec.title,
          },
          rawJob.id,
        );

        return input.jobService.markSucceeded(rawJob.id, { featureId, kind: "product" });
      }

      case "GenerateFeatureUxSpec":
      case "GenerateFeatureTechSpec":
      case "GenerateFeatureUserDocs":
      case "GenerateFeatureArchDocs": {
        if (!input.featureWorkstreamService || !input.milestoneService) {
          throw new Error(`${rawJob.type} requires feature workstream support.`);
        }

        const jobInput = parseJobInputs<{ featureId?: string; hint?: string }>(rawJob.inputs);
        const featureId = jobInput?.featureId;

        if (!featureId) {
          throw new Error(`${rawJob.type} requires a featureId.`);
        }

        const { productSpec, uxSpec, technicalSpec } = await loadApprovedProjectSpecs();
        const context = await input.featureWorkstreamService.getFeatureContext(
          ownerUserId,
          featureId,
        );
        const tracks = await input.featureWorkstreamService.getTracks(ownerUserId, featureId);
        const milestoneContext = await loadMilestonePromptContext(
          context.feature.milestoneId,
          featureId,
        );

        let prompt = "";
        let kind: "ux" | "tech" | "user_docs" | "arch_docs";
        let workstreamLabel = "";

        if (rawJob.type === "GenerateFeatureUxSpec") {
          if (!tracks.tracks.product.headRevision?.approval) {
            throw new Error("GenerateFeatureUxSpec requires an approved feature Product Spec.");
          }

          kind = "ux";
          workstreamLabel = "feature UX Spec";
          prompt = buildFeatureUxSpecPrompt({
            featureProductSpec: tracks.tracks.product.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            projectProductSpec: productSpec.markdown,
            projectUxSpec: uxSpec.markdown,
            siblingFeatures: milestoneContext.siblingFeatures,
            hint: jobInput?.hint,
          });
        } else if (rawJob.type === "GenerateFeatureTechSpec") {
          if (!tracks.tracks.product.headRevision?.approval) {
            throw new Error("GenerateFeatureTechSpec requires an approved feature Product Spec.");
          }

          kind = "tech";
          workstreamLabel = "feature Technical Spec";
          prompt = buildFeatureTechSpecPrompt({
            featureProductSpec: tracks.tracks.product.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            projectProductSpec: productSpec.markdown,
            projectTechnicalSpec: technicalSpec.markdown,
            siblingFeatures: milestoneContext.siblingFeatures,
            hint: jobInput?.hint,
          });
        } else if (rawJob.type === "GenerateFeatureUserDocs") {
          if (!tracks.tracks.product.headRevision?.approval) {
            throw new Error("GenerateFeatureUserDocs requires an approved feature Product Spec.");
          }

          kind = "user_docs";
          workstreamLabel = "feature User Documentation";
          prompt = buildFeatureUserDocsPrompt({
            featureProductSpec: tracks.tracks.product.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            projectProductSpec: productSpec.markdown,
            projectUxSpec: uxSpec.markdown,
            siblingFeatures: milestoneContext.siblingFeatures,
            hint: jobInput?.hint,
          });
        } else {
          if (tracks.tracks.tech.required && !tracks.tracks.tech.headRevision?.approval) {
            const featureTitle = context.headFeatureRevision?.title ?? featureId;
            throw new Error(
              `Cannot generate architecture docs for "${featureTitle}": the feature tech spec must be approved first.`,
            );
          }

          kind = "arch_docs";
          workstreamLabel = "feature Architecture Documentation";
          prompt = buildFeatureArchDocsPrompt({
            featureTechSpec: tracks.tracks.tech.headRevision?.markdown ?? null,
            featureTitle: context.headFeatureRevision.title,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            projectTechnicalSpec: technicalSpec.markdown,
            siblingFeatures: milestoneContext.siblingFeatures,
            hint: jobInput?.hint,
          });
        }
        const featureContext = {
          acceptanceCriteria: Array.isArray(context.headFeatureRevision.acceptanceCriteria)
            ? context.headFeatureRevision.acceptanceCriteria.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          featureKey: context.feature.featureKey,
          milestoneTitle: milestoneContext.milestone.title,
          summary: context.headFeatureRevision.summary,
          title: context.headFeatureRevision.title,
        };
        const generatedSpec = await runReviewedJsonGeneration({
          templateId: rawJob.type,
          parameters: { featureId, kind },
          prompt,
          parseDraft: parseFeatureWorkstreamResult,
          buildReviewPrompt: (draft) =>
            buildFeatureWorkstreamReviewPrompt({
              workstreamLabel,
              feature: featureContext,
              milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
              siblingFeatures: milestoneContext.siblingFeatures,
              draftTitle: draft.title,
              draftMarkdown: draft.markdown,
              hint: jobInput?.hint,
            }),
        });
        await input.featureWorkstreamService.createRevision(
          ownerUserId,
          featureId,
          kind,
          {
            markdown: generatedSpec.markdown,
            source: rawJob.type,
            title: generatedSpec.title,
          },
          rawJob.id,
        );

        return input.jobService.markSucceeded(rawJob.id, { featureId, kind });
      }

      case "GenerateTaskClarifications":
      case "AutoAnswerTaskClarifications":
      case "GenerateFeatureTaskList": {
        if (!input.db || !input.milestoneService) {
          throw new Error(`${rawJob.type} requires database access.`);
        }

        const { createTaskPlanningService } = await import("../task-planning-service.js");
        const taskPlanning = createTaskPlanningService(
          input.db,
          input.milestoneService,
          input.featureWorkstreamService,
        );

        const featureId = (rawJob.inputs as { featureId?: string; sessionId?: string }).featureId;
        const sessionId = (rawJob.inputs as { featureId?: string; sessionId?: string }).sessionId;

        if (!featureId || !sessionId) {
          throw new Error(`${rawJob.type} requires featureId and sessionId.`);
        }

        const context = await taskPlanning.getFeatureContext(ownerUserId, featureId);
        const taskHint =
          typeof (rawJob.inputs as { hint?: unknown } | null | undefined)?.hint === "string"
            ? (rawJob.inputs as { hint?: string }).hint
            : undefined;

        const tracks = await input.featureWorkstreamService?.getTracks(ownerUserId, featureId);

        if (!tracks || !isTaskPlanningReady(tracks.tracks)) {
          throw new Error(
            tracks
              ? buildTaskPlanningReadinessMessage(tracks.tracks)
              : `${rawJob.type} requires feature workstream support.`,
          );
        }
        const planningDocuments = buildTaskPlanningDocuments(tracks.tracks);

        const featureContext = {
          acceptanceCriteria: context.headFeatureRevision.acceptanceCriteria as string[],
          featureKey: context.feature.featureKey,
          milestoneTitle: (
            await getScopedMilestone(context.feature.milestoneId)
          )?.title ?? context.feature.milestoneId,
          summary: context.headFeatureRevision.summary,
          title: context.headFeatureRevision.title,
        };

        const milestoneContext = await loadMilestonePromptContext(
          context.feature.milestoneId,
          featureId,
        );

        if (rawJob.type === "GenerateTaskClarifications") {
          const prompt = buildTaskClarificationsPrompt({
            feature: featureContext,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            planningDocuments,
            hint: taskHint,
          });
          const clarifications = await runStructuredJsonGeneration({
            templateId: rawJob.type,
            parameters: { featureId, sessionId },
            prompt,
            parse: (content) => parseTaskClarificationsResult(content),
          });
          await taskPlanning.createClarifications(sessionId, clarifications);

          return input.jobService.markSucceeded(rawJob.id, { featureId, sessionId });
        }

        if (rawJob.type === "AutoAnswerTaskClarifications") {
          const existingClarifications = await taskPlanning.getClarifications(
            ownerUserId,
            sessionId,
          );

          const pendingClarifications = existingClarifications.filter(
            (c) => c.status === "pending",
          );

          if (pendingClarifications.length === 0) {
            return input.jobService.markSucceeded(rawJob.id, { featureId, sessionId });
          }

          const prompt = buildAutoAnswerClarificationsPrompt({
            clarifications: pendingClarifications.map((c) => ({
              question: c.question,
              context: c.context,
            })),
            feature: featureContext,
            milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
            planningDocuments,
            hint: taskHint,
          });
          const answers = await runStructuredJsonGeneration({
            templateId: rawJob.type,
            parameters: { featureId, sessionId },
            prompt,
            parse: (content) => parseAutoAnswerResult(content),
          });

          for (let i = 0; i < Math.min(pendingClarifications.length, answers.length); i++) {
            await taskPlanning.answerClarification(
              ownerUserId,
              featureId,
              pendingClarifications[i].id,
              answers[i].answer,
              "auto",
            );
          }

          return input.jobService.markSucceeded(rawJob.id, { featureId, sessionId });
        }

        const existingClarifications = await taskPlanning.getClarifications(
          ownerUserId,
          sessionId,
        );

        const answeredClarifications = existingClarifications.filter(
          (c) => c.status === "answered",
        );

        const prompt = buildFeatureTaskListPrompt({
          clarifications: answeredClarifications.map((c) => ({
            question: c.question,
            answer: c.answer ?? "",
          })),
          feature: featureContext,
          milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
          planningDocuments,
          hint: taskHint,
        });
        const tasks = await runReviewedJsonGeneration({
          templateId: rawJob.type,
          parameters: { featureId, sessionId },
          prompt,
          parseDraft: (content) => parseTaskListResult(content),
          buildReviewPrompt: (draftTasks) =>
            buildFeatureTaskListReviewPrompt({
              feature: featureContext,
              milestoneDesignDoc: milestoneContext.milestoneDesignDoc,
              planningDocuments,
              draftTasks,
              hint: taskHint,
            }),
        });
        await taskPlanning.createTasks(sessionId, tasks);

        return input.jobService.markSucceeded(rawJob.id, { featureId, sessionId });
      }

      case "PlanFeatureTasksSandbox": {
        if (!input.db || !input.milestoneService || !input.sandboxService) {
          throw new Error("PlanFeatureTasksSandbox requires database, milestone, and sandbox support.");
        }

        const taskSandboxInputs = parseJobInputs<{ featureId?: string; sessionId?: string }>(rawJob.inputs);
        const taskSandboxFeatureId = taskSandboxInputs?.featureId;

        if (!taskSandboxFeatureId) {
          throw new Error("PlanFeatureTasksSandbox requires featureId.");
        }

        const taskSandboxTaskPlanning = createTaskPlanningService(
          input.db,
          input.milestoneService,
          input.featureWorkstreamService,
        );

        // Verify workstreams are ready before triggering the sandbox
        const taskSandboxTracks = await input.featureWorkstreamService?.getTracks(ownerUserId, taskSandboxFeatureId);
        if (!taskSandboxTracks || !isTaskPlanningReady(taskSandboxTracks.tracks)) {
          throw new Error(
            taskSandboxTracks
              ? buildTaskPlanningReadinessMessage(taskSandboxTracks.tracks)
              : "PlanFeatureTasksSandbox requires feature workstream support.",
          );
        }

        const taskSandboxSession = await taskSandboxTaskPlanning.getOrCreateSession(
          ownerUserId,
          taskSandboxFeatureId,
        );
        const sandboxRun = await input.sandboxService.createFeatureTaskPlanningRun(
          ownerUserId,
          rawJob.projectId,
          taskSandboxFeatureId,
          taskSandboxSession.id,
          rawJob.id,
        );

        return input.jobService.markSucceeded(rawJob.id, {
          featureId: taskSandboxFeatureId,
          sessionId: taskSandboxSession.id,
          sandboxRunId: sandboxRun.id,
        });
      }

      case "RepoFingerprint": {
        if (!input.contextPackService) {
          throw new Error("RepoFingerprint requires context pack support.");
        }

        const chunk = await input.contextPackService.buildRepoFingerprint(
          ownerUserId,
          projectId,
          rawJob.id,
        );

        return input.jobService.markSucceeded(rawJob.id, {
          chunkId: chunk.id,
          projectId,
        });
      }

      case "BuildContextPack": {
        if (!input.contextPackService) {
          throw new Error("BuildContextPack requires context pack support.");
        }

        const jobInput = rawJob.inputs as {
          featureId?: string;
          type?: "planning" | "coding";
        };
        const pack = await input.contextPackService.buildContextPack(
          ownerUserId,
          projectId,
          {
            featureId: jobInput.featureId,
            type: jobInput.type ?? "coding",
            createdByJobId: rawJob.id,
          },
        );

        return input.jobService.markSucceeded(rawJob.id, {
          contextPackId: pack.id,
          featureId: pack.featureId,
          type: pack.type,
        });
      }

      case "RunProjectReview": {
        if (!input.sandboxService || !input.projectReviewService) {
          throw new Error("RunProjectReview requires sandbox and project review support.");
        }

        const jobInput = rawJob.inputs as { attemptId?: string; sessionId?: string };
        if (!jobInput.attemptId || !jobInput.sessionId) {
          throw new Error("RunProjectReview requires attemptId and sessionId.");
        }

        const session = await input.db.query.projectReviewSessionsTable.findFirst({
          where: eq(projectReviewSessionsTable.id, jobInput.sessionId),
        });
        const run = await input.sandboxService.createProjectReviewRun(
          ownerUserId,
          projectId,
          rawJob.id,
          session?.branchName ?? null,
        );
        await input.projectReviewService.markAttemptRunning(jobInput.attemptId, run.id);
        await input.sandboxService.executeRun(rawJob.id, run.id);
        const [reportMarkdown, reportJson, finalRun] = await Promise.all([
          input.sandboxService
            .getRunArtifact(ownerUserId, run.id, "project-review.md")
            .then((artifact) => artifact.content.toString())
            .catch(() => {
              throw new Error("Project review run did not produce project-review.md.");
            }),
          input.sandboxService
            .getRunArtifact(ownerUserId, run.id, "project-review.json")
            .then((artifact) => artifact.content.toString())
            .catch(() => {
              throw new Error("Project review run did not produce project-review.json.");
            }),
          input.sandboxService.getRun(ownerUserId, run.id),
        ]);
        const result = await input.projectReviewService.completeReviewAttempt(
          jobInput.attemptId,
          reportMarkdown,
          reportJson,
          {
            id: run.id,
            branchName: finalRun.run.branchName,
            pullRequestUrl: finalRun.run.pullRequestUrl,
          },
        );
        return input.jobService.markSucceeded(rawJob.id, {
          sandboxRunId: run.id,
          sessionId: result.sessionId,
          clear: result.clear,
          findingCount: result.findingCount,
        });
      }

      case "RunProjectFix": {
        if (!input.sandboxService || !input.projectReviewService) {
          throw new Error("RunProjectFix requires sandbox and project review support.");
        }

        const jobInput = rawJob.inputs as { attemptId?: string; sessionId?: string };
        if (!jobInput.attemptId || !jobInput.sessionId) {
          throw new Error("RunProjectFix requires attemptId and sessionId.");
        }

        const session = await input.db.query.projectReviewSessionsTable.findFirst({
          where: eq(projectReviewSessionsTable.id, jobInput.sessionId),
        });
        const run = await input.sandboxService.createProjectFixRun(
          ownerUserId,
          projectId,
          rawJob.id,
          session?.branchName ?? null,
        );
        await input.projectReviewService.markAttemptRunning(jobInput.attemptId, run.id);
        await input.sandboxService.executeRun(rawJob.id, run.id);
        const finalRun = await input.sandboxService.getRun(ownerUserId, run.id);
        const result = await input.projectReviewService.completeFixAttempt(jobInput.attemptId, {
          branchName: finalRun.run.branchName,
          pullRequestUrl: finalRun.run.pullRequestUrl,
        });
        return input.jobService.markSucceeded(rawJob.id, {
          sandboxRunId: run.id,
          sessionId: result.sessionId,
        });
      }

      case "RunBugFix": {
        if (!input.sandboxService || !input.bugService) {
          throw new Error("RunBugFix requires sandbox and bug service support.");
        }

        const bugId = (rawJob.inputs as { bugId?: string }).bugId;
        if (!bugId) {
          throw new Error("RunBugFix requires bugId.");
        }

        let runId: string | null = null;

        try {
          const run = await input.sandboxService.createBugFixRun(
            ownerUserId,
            projectId,
            bugId,
            rawJob.id,
          );
          runId = run.id;
          await input.bugService.attachSandboxRun(bugId, run.id);
          await input.sandboxService.executeRun(rawJob.id, run.id);
          const finalRun = await input.sandboxService.getRun(ownerUserId, run.id);

          if (finalRun.run.outcome !== "changes_applied" || !finalRun.run.branchName) {
            throw new Error("Bug fix run did not produce a mergeable pull request.");
          }

          const mergeResult = await input.bugService.mergeFixPullRequest(
            ownerUserId,
            bugId,
            finalRun.run.branchName,
          );

          if (!mergeResult.merged) {
            throw new Error("Open pull request could not be found for the bug fix branch.");
          }

          await input.bugService.completeFix(ownerUserId, bugId, {
            pullRequestUrl: mergeResult.pullRequestUrl,
            sandboxRunId: run.id,
          });

          return input.jobService.markSucceeded(rawJob.id, {
            bugId,
            sandboxRunId: run.id,
            pullRequestUrl: mergeResult.pullRequestUrl,
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "Bug fix run failed.";
          await input.bugService.failFix(ownerUserId, bugId, message, runId);
          throw error;
        }
      }

      case "ImplementChange":
      case "TestAndVerify": {
        if (!input.sandboxService) {
          throw new Error(`${rawJob.type} requires sandbox service support.`);
        }

        const sandboxRunId = (rawJob.inputs as { sandboxRunId?: string }).sandboxRunId;
        if (!sandboxRunId) {
          throw new Error(`${rawJob.type} requires sandboxRunId.`);
        }

        await input.sandboxService.executeRun(rawJob.id, sandboxRunId);
        return input.jobService.markSucceeded(rawJob.id, { sandboxRunId });
      }

      case "WaitForMilestoneCi": {
        if (!input.milestoneService) {
          throw new Error("WaitForMilestoneCi requires milestone service support.");
        }

        const milestoneId = (rawJob.inputs as { milestoneId?: string }).milestoneId;
        if (!milestoneId) {
          throw new Error("WaitForMilestoneCi requires milestoneId.");
        }

        const milestone = await input.db.query.milestonesTable.findFirst({
          where: eq(milestonesTable.id, milestoneId),
        });
        if (!milestone) {
          throw new Error("Milestone not found.");
        }

        const startedAt = rawJob.startedAt ?? new Date();
        let state:
          | "passing"
          | "failing"
          | "pending"
          | "no_ci"
          | "pending_window_exhausted"
          | "stale_pending" =
          "pending";
        let lastStatus:
          | Awaited<ReturnType<typeof input.milestoneService.getMilestoneCiStatus>>
          | null = null;

        while (Date.now() - startedAt.getTime() < 5 * 60_000) {
          lastStatus = await input.milestoneService.getMilestoneCiStatus(
            ownerUserId,
            projectId,
            milestone,
          );
          state = lastStatus?.state ?? "no_ci";
          if (state === "pending" && lastStatus?.isStale) {
            state = "stale_pending";
            break;
          }
          if (state !== "pending") {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 30_000));
        }

        if (state === "pending") {
          state = "pending_window_exhausted";
        }

        return input.jobService.markSucceeded(rawJob.id, {
          milestoneId,
          state,
          ciStatus: lastStatus,
        });
      }

      case "RepairMilestoneCi": {
        if (!input.sandboxService) {
          throw new Error("RepairMilestoneCi requires sandbox service support.");
        }

        const milestoneId = (rawJob.inputs as { milestoneId?: string }).milestoneId;
        if (!milestoneId) {
          throw new Error("RepairMilestoneCi requires milestoneId.");
        }

        const run = await input.sandboxService.createMilestoneCiRepairRun(
          ownerUserId,
          projectId,
          milestoneId,
          rawJob.id,
        );
        await input.sandboxService.executeRun(rawJob.id, run.id);
        return input.jobService.markSucceeded(rawJob.id, {
          milestoneId,
          sandboxRunId: run.id,
        });
      }

      case "ExecuteMilestoneSession": {
        if (!input.sandboxService) {
          throw new Error("ExecuteMilestoneSession requires sandbox service support.");
        }

        const sandboxMilestoneSessionId = (
          rawJob.inputs as { sandboxMilestoneSessionId?: string }
        ).sandboxMilestoneSessionId;
        if (!sandboxMilestoneSessionId) {
          throw new Error("ExecuteMilestoneSession requires sandboxMilestoneSessionId.");
        }

        await input.sandboxService.runMilestoneSession(
          rawJob.id,
          sandboxMilestoneSessionId,
        );
        return input.jobService.markSucceeded(rawJob.id, { sandboxMilestoneSessionId });
      }

      case "ReviewDelivery": {
        if (!input.milestoneService) {
          throw new Error("ReviewDelivery requires milestone service support.");
        }

        const [productSpec, userFlows, milestones] = await Promise.all([
          input.productSpecService.getCanonical(ownerUserId, rawJob.projectId),
          input.userFlowService.list(ownerUserId, rawJob.projectId),
          input.milestoneService.list(ownerUserId, rawJob.projectId),
        ]);
        const uncoveredFlowSet = new Set(milestones.coverage.uncoveredUserFlowIds);
        const uncoveredFlows = userFlows.userFlows.filter((flow) => uncoveredFlowSet.has(flow.id));

        if (uncoveredFlows.length > 0) {
          const state = await input.milestoneService.getMilestoneMapMutationState(rawJob.projectId);

          return input.jobService.markSucceeded(rawJob.id, {
            complete: false,
            issues: [
              {
                jobType: state.replacementLocked ? "AppendMilestones" : "GenerateMilestones",
                hint: buildUncoveredMilestoneFlowHint(uncoveredFlows),
              },
            ],
          });
        }

        const prompt = buildDeliveryReviewPrompt({
          projectName: project.name,
          productSpec: productSpec?.markdown ?? "",
          userFlows: userFlows.userFlows.map((flow) => ({
            title: flow.title,
            userStory: flow.userStory,
          })),
          coverage: {
            approvedUserFlowCount: milestones.coverage.approvedUserFlowCount,
            coveredUserFlowCount: milestones.coverage.coveredUserFlowCount,
            uncoveredUserFlowTitles: [],
          },
          milestones: milestones.milestones.map((milestone) => ({
            title: milestone.title,
            summary: milestone.summary,
            featureCount: milestone.featureCount,
          })),
        });

        const generated = await generateWithJobFailure(prompt, {
          responseFormat: "json",
          templateId: rawJob.type,
        });
        await storeLlmRun({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          generated,
        });

        const parsed = await parseStructuredJsonWithRepair({
          templateId: rawJob.type,
          parameters: {},
          prompt,
          generated,
          parse: (content, templateId) => {
            const parsed = parseJson<{
              complete?: boolean;
              issues?: Array<{ jobType?: string; hint?: string }>;
            }>(content);

            if (!parsed || typeof parsed.complete !== "boolean") {
              throw new Error(
                `${templateId} returned invalid content. Expected JSON with a "complete" boolean.`,
              );
            }

            return parsed;
          },
        });

        const issues = (parsed.issues ?? [])
          .filter(
            (issue): issue is { jobType: string; hint: string } =>
              typeof issue.jobType === "string" && typeof issue.hint === "string",
          );

        return input.jobService.markSucceeded(rawJob.id, {
          complete: parsed.complete,
          issues,
        });
      }

      default:
        throw new Error(`Unsupported job type: ${rawJob.type}`);
    }
  },
});

export type JobRunnerService = ReturnType<typeof createJobRunnerService>;
