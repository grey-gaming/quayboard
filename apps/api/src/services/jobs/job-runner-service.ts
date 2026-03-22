import { and, eq, isNull } from "drizzle-orm";

import {
  createFeatureProductRevisionRequestSchema,
  createFeatureWorkstreamRevisionRequestSchema,
  featureKindSchema,
  prioritySchema,
  questionnaireAnswerMapSchema,
  questionnaireDefinition,
} from "@quayboard/shared";

import type { AppDatabase } from "../../db/client.js";
import {
  llmRunsTable,
  milestoneUseCasesTable,
  milestonesTable,
  useCasesTable,
} from "../../db/schema.js";
import type { ArtifactApprovalService } from "../artifact-approval-service.js";
import type { BlueprintService } from "../blueprint-service.js";
import type { FeatureService } from "../feature-service.js";
import type { FeatureWorkstreamService } from "../feature-workstream-service.js";
import { generateId } from "../ids.js";
import type { LlmProviderService } from "../llm-provider.js";
import type { MilestoneService } from "../milestone-service.js";
import type { OnePagerService } from "../one-pager-service.js";
import type { ProductSpecService } from "../product-spec-service.js";
import type { ProjectService } from "../project-service.js";
import type { ProjectSetupService } from "../project-setup-service.js";
import type { QuestionnaireService } from "../questionnaire-service.js";
import type { UserFlowService } from "../user-flow-service.js";
import {
  buildAppendFeaturesFromOnePagerPrompt,
  buildDecisionConsistencyPrompt,
  buildDecisionDeckPrompt,
  buildFeatureArchDocsPrompt,
  buildFeatureProductSpecPrompt,
  buildFeatureTechSpecPrompt,
  buildFeatureUserDocsPrompt,
  buildFeatureUxSpecPrompt,
  buildMilestoneDesignPrompt,
  buildMilestonePlanPrompt,
  buildProjectBlueprintPrompt,
  buildQuestionnaireAutoAnswerPrompt,
  buildProjectDescriptionPrompt,
  buildProjectOverviewPrompt,
  buildProductSpecPrompt,
  buildProductSpecReviewPrompt,
  buildUserFlowPrompt,
} from "./job-prompts.js";
import type { JobService } from "./job-service.js";

const unwrapJsonFence = (value: string) => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fencedMatch?.[1]?.trim() || trimmed;
};

const parseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(unwrapJsonFence(value)) as T;
  } catch {
    return null;
  }
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
      flowSteps?: string[];
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

  const requirements = parsed.requirements
    ? createFeatureProductRevisionRequestSchema.shape.requirements.parse(parsed.requirements)
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
    flowSteps?: string[];
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
    if (
      !flow.title?.trim() ||
      !flow.userStory?.trim() ||
      !flow.entryPoint?.trim() ||
      !flow.endState?.trim() ||
      !flow.flowSteps?.length
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
      flowSteps: flow.flowSteps,
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

const parseMilestonesResult = (
  value: string,
):
  | Array<{
      title?: string;
      summary?: string;
      useCaseIds?: string[];
    }>
  | null => parseJson(value);

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

  return milestones.map((milestone) => {
    if (
      !milestone.title?.trim() ||
      !milestone.summary?.trim() ||
      !Array.isArray(milestone.useCaseIds) ||
      milestone.useCaseIds.length === 0
    ) {
      throw new Error(
        "GenerateMilestones returned an incomplete milestone. Each milestone must include title, summary, and at least one useCaseId.",
      );
    }

    return {
      title: milestone.title.trim(),
      summary: milestone.summary.trim(),
      useCaseIds: milestone.useCaseIds,
    };
  });
};

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

const validateGeneratedFeatures = (
  items: Array<{
    title?: string;
    summary?: string;
    acceptanceCriteria?: string[];
    kind?: string;
    priority?: string;
  }>,
) => {
  if (items.length === 0) {
    throw new Error(
      "AppendFeatureFromOnePager returned invalid content. Expected a non-empty JSON array of features.",
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
        "AppendFeatureFromOnePager returned an incomplete feature. Each feature must include title, summary, and at least one acceptance criterion.",
      );
    }

    const kind = featureKindSchema.safeParse(item.kind);
    if (!kind.success) {
      throw new Error("AppendFeatureFromOnePager returned an unsupported feature kind.");
    }

    const priority = prioritySchema.safeParse(item.priority);
    if (!priority.success) {
      throw new Error("AppendFeatureFromOnePager returned an unsupported feature priority.");
    }

    return {
      title: item.title.trim(),
      summary: item.summary.trim(),
      acceptanceCriteria: item.acceptanceCriteria.map((criterion) => criterion.trim()),
      kind: kind.data,
      priority: priority.data,
    };
  });
};

export const createJobRunnerService = (input: {
  artifactApprovalService: ArtifactApprovalService;
  blueprintService: BlueprintService;
  db: AppDatabase;
  featureService?: FeatureService;
  featureWorkstreamService?: FeatureWorkstreamService;
  jobService: JobService;
  llmProviderService: LlmProviderService;
  milestoneService?: MilestoneService;
  onePagerService: OnePagerService;
  productSpecService: ProductSpecService;
  projectService: ProjectService;
  projectSetupService: ProjectSetupService;
  questionnaireService: QuestionnaireService;
  userFlowService: UserFlowService;
}) => ({
  async run(jobId: string) {
    const rawJob = await input.jobService.getRawJob(jobId);

    if (!rawJob || !rawJob.projectId || !rawJob.createdByUserId) {
      throw new Error("Job context is incomplete.");
    }

    const ownerUserId = rawJob.createdByUserId;
    const projectId = rawJob.projectId;
    const project = await input.projectService.getOwnedProject(ownerUserId, projectId);
    const provider = await input.projectSetupService.getLlmDefinition(
      ownerUserId,
      projectId,
    );
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

    switch (rawJob.type) {
      case "GenerateProjectDescription": {
        const questionnaire = await input.questionnaireService.getAnswers(rawJob.projectId);
        const prompt = buildProjectDescriptionPrompt(questionnaire.answers);
        const generated = await input.llmProviderService.generate(provider, prompt);
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: "GenerateProjectDescription",
          parameters: {},
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const description = generated.content.trim();
        await input.projectService.updateOwnedProject(ownerUserId, rawJob.projectId, {
          description,
        });
        return input.jobService.markSucceeded(rawJob.id, { description });
      }

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
        const generated = await input.llmProviderService.generate(provider, prompt);
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: "AutoAnswerQuestionnaire",
          parameters: {},
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const parsed = parseJson<Record<string, string>>(generated.content);

        if (!parsed) {
          throw new Error(
            "AutoAnswerQuestionnaire returned invalid content. Expected a JSON object keyed by questionnaire fields.",
          );
        }

        const parsedAnswers = questionnaireAnswerMapSchema.parse(parsed);
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
        const generated = await input.llmProviderService.generate(provider, prompt);
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: {},
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const parsed = parseJson<{ description?: string; markdown?: string; title?: string }>(
          generated.content,
        );

        if (!parsed?.title?.trim() || !parsed?.description?.trim() || !parsed?.markdown?.trim()) {
          throw new Error(
            `${rawJob.type} returned invalid content. Expected JSON with non-empty "title", "description", and "markdown".`,
          );
        }

        await input.projectService.updateOwnedProject(ownerUserId, rawJob.projectId, {
          description: parsed.description.trim(),
        });

        const onePager = await input.onePagerService.createVersion({
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          source: rawJob.type,
          title: parsed.title.trim(),
          markdown: parsed.markdown.trim(),
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

        const prompt = buildProductSpecPrompt({
          projectName: project.name,
          sourceMaterial: onePager.markdown,
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
          generated = await input.llmProviderService.generate(provider, prompt, {
            responseFormat: "json",
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
        const firstPass = parseProductSpecResult(generated.content, rawJob.type);
        const reviewPrompt = buildProductSpecReviewPrompt({
          projectName: project.name,
          draftTitle: firstPass.title,
          draftMarkdown: firstPass.markdown,
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
          reviewed = await input.llmProviderService.generate(provider, reviewPrompt, {
            responseFormat: "json",
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
        const reviewedProductSpec = parseProductSpecResult(reviewed.content, reviewTemplateId);

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

        const prompt = buildUserFlowPrompt({
          projectName: project.name,
          sourceMaterial: `${productSpec.markdown}\n\n# Technical Spec\n\n${technicalSpec.markdown}`,
        });
        const generated = await input.llmProviderService.generate(provider, prompt);
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: {},
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const parsed = parseGeneratedUserFlowsResult(generated.content);

        if (!parsed || parsed.length === 0) {
          throw new Error(
            "GenerateUseCases returned invalid content. Expected a non-empty JSON array of user flows.",
          );
        }

        const flowsToCreate = validateGeneratedUserFlows(parsed);
        await input.userFlowService.createMany(ownerUserId, rawJob.projectId, flowsToCreate);

        return input.jobService.markSucceeded(rawJob.id, { createdCount: parsed.length });
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
        const jobInput = parseJson<{ kind?: "tech" | "ux" }>(JSON.stringify(rawJob.inputs));
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
        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: { kind },
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const parsed = parseJson<
          Array<{
            alternatives?: Array<{ description?: string; id?: string; label?: string }>;
            category?: string;
            key?: string;
            prompt?: string;
            recommendation?: { description?: string; id?: string; label?: string };
            title?: string;
          }>
        >(generated.content);

        if (!parsed) {
          throw new Error(
            "GenerateDecisionDeck returned invalid content. Expected a JSON array of decision cards.",
          );
        }

        const cards = validateGeneratedDecisionDeck(parsed);
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
        const jobInput = parseJson<{ kind?: "tech" | "ux" }>(JSON.stringify(rawJob.inputs));
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
        const serializedSelections = JSON.stringify(
          await input.blueprintService.getDecisionSelections(ownerUserId, rawJob.projectId, kind),
          null,
          2,
        );
        const consistencyPrompt = buildDecisionConsistencyPrompt({
          kind,
          projectName: project.name,
          productSpec: productSpec.markdown,
          decisions: serializedSelections,
          uxSpec: uxSpec?.markdown,
        });
        const consistency = await input.llmProviderService.generate(provider, consistencyPrompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: "ValidateDecisionConsistency",
          parameters: { kind },
          input: { prompt: consistencyPrompt },
          output: { content: consistency.content },
          promptTokens: consistency.promptTokens,
          completionTokens: consistency.completionTokens,
          createdAt: new Date(),
        });
        const consistencyResult = parseDecisionValidationResult(consistency.content);

        if (!consistencyResult.ok) {
          throw new Error(
            `ValidateDecisionConsistency found conflicts: ${(consistencyResult.issues ?? []).join("; ") || "unknown issue"}`,
          );
        }

        const prompt = buildProjectBlueprintPrompt({
          kind,
          projectName: project.name,
          productSpec: productSpec.markdown,
          decisions: serializedSelections,
          uxSpec: uxSpec?.markdown,
        });
        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: { kind },
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const blueprintPayload = parseBlueprintResult(generated.content, rawJob.type);
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
        });
        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: {},
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const parsed = parseMilestonesResult(generated.content);

        if (!parsed) {
          throw new Error(
            "GenerateMilestones returned invalid content. Expected a JSON array of milestones.",
          );
        }

        const milestones = validateGeneratedMilestones(parsed);
        for (const milestone of milestones) {
          await input.milestoneService.create(
            ownerUserId,
            rawJob.projectId,
            milestone,
            rawJob.id,
          );
        }

        return input.jobService.markSucceeded(rawJob.id, { createdCount: milestones.length });
      }

      case "GenerateMilestoneDesign": {
        if (!input.milestoneService) {
          throw new Error("GenerateMilestoneDesign requires milestone service support.");
        }

        const jobInput = parseJson<{ milestoneId?: string }>(JSON.stringify(rawJob.inputs));
        const milestoneId = jobInput?.milestoneId;

        if (!milestoneId) {
          throw new Error("GenerateMilestoneDesign requires a milestoneId.");
        }

        const milestone = await input.milestoneService.getContext(ownerUserId, milestoneId);
        if (milestone.status !== "approved") {
          throw new Error("GenerateMilestoneDesign requires an approved milestone.");
        }

        const [blueprints, milestoneRecord, linkedFlows] = await Promise.all([
          input.blueprintService.getCanonical(ownerUserId, rawJob.projectId),
          input.db.query.milestonesTable.findFirst({
            where: eq(milestonesTable.id, milestoneId),
          }),
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

        const prompt = buildMilestoneDesignPrompt({
          projectName: project.name,
          milestoneTitle: milestoneRecord.title,
          milestoneSummary: milestoneRecord.summary,
          linkedUserFlows: linkedFlows,
          uxSpec: blueprints.uxBlueprint.markdown,
          technicalSpec: blueprints.techBlueprint.markdown,
        });
        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: { milestoneId },
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const designDoc = parseBlueprintResult(generated.content, rawJob.type);
        const created = await input.milestoneService.createDesignDocVersion({
          milestoneId,
          title: designDoc.title,
          markdown: designDoc.markdown,
          source: rawJob.type,
          createdByJobId: rawJob.id,
        });

        return input.jobService.markSucceeded(rawJob.id, { designDocId: created.id });
      }

      case "AppendFeatureFromOnePager": {
        if (!input.featureService) {
          throw new Error("AppendFeatureFromOnePager requires feature service support.");
        }

        const jobInput = parseJson<{ milestoneId?: string }>(JSON.stringify(rawJob.inputs));
        const milestoneId = jobInput?.milestoneId;

        if (!milestoneId) {
          throw new Error("AppendFeatureFromOnePager requires a milestoneId.");
        }

        await input.featureService.assertApprovedMilestone(rawJob.projectId, milestoneId);
        const overview = await input.onePagerService.getCanonical(ownerUserId, rawJob.projectId);
        if (!overview?.approvedAt) {
          throw new Error("AppendFeatureFromOnePager requires an approved overview document.");
        }

        const [features, milestoneRecord] = await Promise.all([
          input.featureService.list(ownerUserId, rawJob.projectId),
          input.db.query.milestonesTable.findFirst({
            where: eq(milestonesTable.id, milestoneId),
          }),
        ]);

        if (!milestoneRecord) {
          throw new Error("AppendFeatureFromOnePager could not load the target milestone.");
        }

        const prompt = buildAppendFeaturesFromOnePagerPrompt({
          projectName: project.name,
          milestoneTitle: milestoneRecord.title,
          overviewDocument: overview.markdown,
          existingFeatures: features.features.map((feature) => ({
            title: feature.headRevision.title,
            summary: feature.headRevision.summary,
          })),
        });
        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: { milestoneId },
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const parsed = parseGeneratedFeaturesResult(generated.content);

        if (!parsed) {
          throw new Error(
            "AppendFeatureFromOnePager returned invalid content. Expected a JSON array of features.",
          );
        }

        const items = validateGeneratedFeatures(parsed);
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

      case "GenerateFeatureProductSpec": {
        if (!input.featureWorkstreamService) {
          throw new Error("GenerateFeatureProductSpec requires feature workstream support.");
        }

        const jobInput = parseJson<{ featureId?: string }>(JSON.stringify(rawJob.inputs));
        const featureId = jobInput?.featureId;

        if (!featureId) {
          throw new Error("GenerateFeatureProductSpec requires a featureId.");
        }

        const { productSpec, uxSpec, technicalSpec } = await loadApprovedProjectSpecs();
        const context = await input.featureWorkstreamService.getFeatureContext(
          ownerUserId,
          featureId,
        );
        const milestone = await input.db.query.milestonesTable.findFirst({
          where: eq(milestonesTable.id, context.feature.milestoneId),
        });

        if (!milestone) {
          throw new Error("GenerateFeatureProductSpec could not load the target milestone.");
        }

        const prompt = buildFeatureProductSpecPrompt({
          feature: {
            acceptanceCriteria: Array.isArray(context.headFeatureRevision.acceptanceCriteria)
              ? context.headFeatureRevision.acceptanceCriteria.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
            featureKey: context.feature.featureKey,
            milestoneTitle: milestone.title,
            summary: context.headFeatureRevision.summary,
            title: context.headFeatureRevision.title,
          },
          productSpec: productSpec.markdown,
          technicalSpec: technicalSpec.markdown,
          uxSpec: uxSpec.markdown,
        });
        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: { featureId },
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const generatedSpec = parseFeatureWorkstreamResult(generated.content, rawJob.type);
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
        if (!input.featureWorkstreamService) {
          throw new Error(`${rawJob.type} requires feature workstream support.`);
        }

        const jobInput = parseJson<{ featureId?: string }>(JSON.stringify(rawJob.inputs));
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

        let prompt = "";
        let kind: "ux" | "tech" | "user_docs" | "arch_docs";

        if (rawJob.type === "GenerateFeatureUxSpec") {
          if (!tracks.tracks.product.headRevision?.approval) {
            throw new Error("GenerateFeatureUxSpec requires an approved feature Product Spec.");
          }

          kind = "ux";
          prompt = buildFeatureUxSpecPrompt({
            featureProductSpec: tracks.tracks.product.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            projectProductSpec: productSpec.markdown,
            projectUxSpec: uxSpec.markdown,
          });
        } else if (rawJob.type === "GenerateFeatureTechSpec") {
          if (!tracks.tracks.product.headRevision?.approval) {
            throw new Error("GenerateFeatureTechSpec requires an approved feature Product Spec.");
          }

          kind = "tech";
          prompt = buildFeatureTechSpecPrompt({
            featureProductSpec: tracks.tracks.product.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            projectProductSpec: productSpec.markdown,
            projectTechnicalSpec: technicalSpec.markdown,
          });
        } else if (rawJob.type === "GenerateFeatureUserDocs") {
          if (!tracks.tracks.product.headRevision?.approval) {
            throw new Error("GenerateFeatureUserDocs requires an approved feature Product Spec.");
          }

          kind = "user_docs";
          prompt = buildFeatureUserDocsPrompt({
            featureProductSpec: tracks.tracks.product.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            projectProductSpec: productSpec.markdown,
            projectUxSpec: uxSpec.markdown,
          });
        } else {
          if (!tracks.tracks.tech.headRevision?.approval) {
            throw new Error("GenerateFeatureArchDocs requires an approved feature Tech Spec.");
          }

          kind = "arch_docs";
          prompt = buildFeatureArchDocsPrompt({
            featureTechSpec: tracks.tracks.tech.headRevision.markdown,
            featureTitle: context.headFeatureRevision.title,
            projectTechnicalSpec: technicalSpec.markdown,
          });
        }

        const generated = await input.llmProviderService.generate(provider, prompt, {
          responseFormat: "json",
        });
        await input.db.insert(llmRunsTable).values({
          id: generateId(),
          projectId: rawJob.projectId,
          jobId: rawJob.id,
          provider: provider.provider,
          model: provider.model,
          templateId: rawJob.type,
          parameters: { featureId, kind },
          input: { prompt },
          output: { content: generated.content },
          promptTokens: generated.promptTokens,
          completionTokens: generated.completionTokens,
          createdAt: new Date(),
        });
        const generatedSpec = parseFeatureWorkstreamResult(generated.content, rawJob.type);
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

      default:
        throw new Error(`Unsupported job type: ${rawJob.type}`);
    }
  },
});

export type JobRunnerService = ReturnType<typeof createJobRunnerService>;
