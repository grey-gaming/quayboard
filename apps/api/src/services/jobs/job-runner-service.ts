import { and, eq, isNull } from "drizzle-orm";

import { questionnaireAnswerMapSchema, questionnaireDefinition } from "@quayboard/shared";

import type { AppDatabase } from "../../db/client.js";
import { llmRunsTable, useCasesTable } from "../../db/schema.js";
import { generateId } from "../ids.js";
import type { LlmProviderService } from "../llm-provider.js";
import type { OnePagerService } from "../one-pager-service.js";
import type { ProductSpecService } from "../product-spec-service.js";
import type { ProjectService } from "../project-service.js";
import type { ProjectSetupService } from "../project-setup-service.js";
import type { QuestionnaireService } from "../questionnaire-service.js";
import type { UserFlowService } from "../user-flow-service.js";
import {
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

export const createJobRunnerService = (input: {
  db: AppDatabase;
  jobService: JobService;
  llmProviderService: LlmProviderService;
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
    const project = await input.projectService.getOwnedProject(ownerUserId, rawJob.projectId);
    const provider = await input.projectSetupService.getLlmDefinition(
      ownerUserId,
      rawJob.projectId,
    );

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

        if (!productSpec?.approvedAt) {
          throw new Error(
            "GenerateUseCases requires an approved Product Spec before user flows can be generated.",
          );
        }

        const prompt = buildUserFlowPrompt({
          projectName: project.name,
          sourceMaterial: productSpec.markdown,
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
        const parsed = parseJson<
          Array<{
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
        >(generated.content);

        if (!parsed || parsed.length === 0) {
          throw new Error(
            "GenerateUseCases returned invalid content. Expected a non-empty JSON array of user flows.",
          );
        }

        for (const flow of parsed) {
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

          await input.userFlowService.create(ownerUserId, rawJob.projectId, {
            acceptanceCriteria: flow.acceptanceCriteria ?? [
              "The described flow can be completed.",
            ],
            coverageTags: flow.coverageTags ?? ["happy-path"],
            doneCriteriaRefs: flow.doneCriteriaRefs ?? ["product-spec"],
            endState: flow.endState,
            entryPoint: flow.entryPoint,
            flowSteps: flow.flowSteps,
            source: flow.source ?? "generated",
            title: flow.title,
            userStory: flow.userStory,
          });
        }

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

      default:
        throw new Error(`Unsupported job type: ${rawJob.type}`);
    }
  },
});

export type JobRunnerService = ReturnType<typeof createJobRunnerService>;
