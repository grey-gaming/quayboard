import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  projectReviewAttemptSchema,
  projectReviewCategorySchema,
  projectReviewDetailResponseSchema,
  projectReviewFindingSchema,
  projectReviewPhaseSchema,
  projectReviewSessionSchema,
  projectReviewSeveritySchema,
  type ProjectReviewAttemptSummary,
  type ProjectReviewDetailResponse,
  type ProjectReviewFinding,
  type ProjectReviewPhase,
  type ProjectReviewSession,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  jobsTable,
  projectReviewAttemptsTable,
  projectReviewFindingsTable,
  projectReviewSessionsTable,
  projectsTable,
  reposTable,
} from "../db/schema.js";
import type { GithubService } from "./github-service.js";
import type { JobService } from "./jobs/job-service.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { ProjectService } from "./project-service.js";
import type { SecretService } from "./secret-service.js";

const ACTIVE_SESSION_STATUSES = [
  "queued_review",
  "running_review",
  "queued_fix",
  "running_fix",
] as const;

const PROJECT_REVIEW_FIX_BRANCH = "quayboard/project-review-fixes";
const DEFAULT_PROJECT_REVIEW_MAX_LOOPS = 5;
const HIGH_ONLY_REMAINING_FIX_PASSES = 2;
const blockingSeverities = new Set<ProjectReviewFinding["severity"]>(["critical", "high"]);
const PROJECT_REVIEW_RETRY_LOOP_INCREMENT = 5;

type AutoAdvanceMeta = {
  batchToken: string;
  sessionId: string;
};

type ParsedReviewPayload = {
  biggestRisks: string[];
  biggestStrengths: string[];
  engineeringQualityVerdict: string;
  executiveSummary: string;
  finalVerdict: ProjectReviewAttemptSummary["finalVerdict"];
  findings: Array<{
    category: ProjectReviewFinding["category"];
    evidence: Array<{ path: string }>;
    finding: string;
    recommendedImprovement: string;
    severity: ProjectReviewFinding["severity"];
    whyItMatters: string;
  }>;
  maturityLevel: string;
  usabilityVerdict: string;
};

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const toNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const normalizeEngineeringQualityVerdict = (value: unknown): string => {
  const direct = toNonEmptyString(value);
  if (direct) {
    return direct;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([key, candidate]) => {
        const normalized = toNonEmptyString(candidate);
        return normalized ? `${key}: ${normalized}` : null;
      })
      .filter((entry): entry is string => entry !== null);

    if (parts.length > 0) {
      return parts.join("; ");
    }
  }

  return "Review did not provide an engineering quality verdict.";
};

export const parseProjectReviewArtifact = (content: string): ParsedReviewPayload => {
  const parsed = parseJson<Record<string, unknown>>(content);
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];

  const normalizedFindings = findings.map((finding) => {
    if (!finding || typeof finding !== "object") {
      throw new Error("project-review.json contains an invalid finding.");
    }

    const candidate = finding as Record<string, unknown>;
    return {
      category: projectReviewCategorySchema.parse(candidate.category),
      severity: projectReviewSeveritySchema.parse(candidate.severity),
      finding:
        typeof candidate.finding === "string" && candidate.finding.trim()
          ? candidate.finding.trim()
          : (() => {
              throw new Error("project-review.json findings require a non-empty finding.");
            })(),
      evidence: Array.isArray(candidate.evidence)
        ? candidate.evidence.map((entry) => {
            if (!entry || typeof entry !== "object" || typeof (entry as { path?: unknown }).path !== "string") {
              throw new Error("project-review.json findings require evidence paths.");
            }

            return { path: (entry as { path: string }).path };
          })
        : [],
      whyItMatters:
        typeof candidate.whyItMatters === "string" && candidate.whyItMatters.trim()
          ? candidate.whyItMatters.trim()
          : (() => {
              throw new Error("project-review.json findings require whyItMatters.");
            })(),
      recommendedImprovement:
        typeof candidate.recommendedImprovement === "string" && candidate.recommendedImprovement.trim()
          ? candidate.recommendedImprovement.trim()
          : (() => {
              throw new Error("project-review.json findings require recommendedImprovement.");
            })(),
    };
  });

  const finalVerdict = parsed.finalVerdict;
  if (!finalVerdict || typeof finalVerdict !== "object") {
    throw new Error("project-review.json requires finalVerdict.");
  }
  const verdict = finalVerdict as Record<string, unknown>;

  return {
    executiveSummary:
      typeof parsed.executiveSummary === "string" && parsed.executiveSummary.trim()
        ? parsed.executiveSummary.trim()
        : (() => {
            throw new Error("project-review.json requires executiveSummary.");
          })(),
    maturityLevel:
      typeof parsed.maturityLevel === "string" && parsed.maturityLevel.trim()
        ? parsed.maturityLevel.trim()
        : (() => {
            throw new Error("project-review.json requires maturityLevel.");
          })(),
    usabilityVerdict:
      typeof parsed.usabilityVerdict === "string" && parsed.usabilityVerdict.trim()
        ? parsed.usabilityVerdict.trim()
        : (() => {
            throw new Error("project-review.json requires usabilityVerdict.");
          })(),
    biggestStrengths: Array.isArray(parsed.biggestStrengths)
      ? parsed.biggestStrengths.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : [],
    biggestRisks: Array.isArray(parsed.biggestRisks)
      ? parsed.biggestRisks.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : [],
    engineeringQualityVerdict: normalizeEngineeringQualityVerdict(parsed.engineeringQualityVerdict),
    finalVerdict: {
      documentationGoodEnough: Boolean(verdict.documentationGoodEnough),
      testsGoodEnough: Boolean(verdict.testsGoodEnough),
      projectCompleteEnough: Boolean(verdict.projectCompleteEnough),
      codeHasMajorIssues: Boolean(verdict.codeHasMajorIssues),
      confidence:
        verdict.confidence === "high" || verdict.confidence === "medium" || verdict.confidence === "low"
          ? verdict.confidence
          : "medium",
    },
    findings: normalizedFindings,
  };
};

const toFinding = (record: typeof projectReviewFindingsTable.$inferSelect) =>
  projectReviewFindingSchema.parse({
    id: record.id,
    projectReviewAttemptId: record.projectReviewAttemptId,
    category: record.category,
    severity: record.severity,
    finding: record.finding,
    evidence: Array.isArray(record.evidence) ? record.evidence : [],
    whyItMatters: record.whyItMatters,
    recommendedImprovement: record.recommendedImprovement,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
  });

export const isProjectReviewHighOnlyPhase = (loopCount: number, maxLoops: number) =>
  maxLoops - loopCount <= HIGH_ONLY_REMAINING_FIX_PASSES;

export const partitionProjectReviewFindings = <
  Finding extends Pick<ProjectReviewFinding, "severity">,
>(
  findings: Finding[],
  highOnlyPhase: boolean,
) => {
  if (!highOnlyPhase) {
    return {
      blocking: findings,
      ignored: [] as Finding[],
    };
  }

  const blocking: Finding[] = [];
  const ignored: Finding[] = [];

  for (const finding of findings) {
    if (blockingSeverities.has(finding.severity)) {
      blocking.push(finding);
    } else {
      ignored.push(finding);
    }
  }

  return { blocking, ignored };
};

export const countOpenProjectReviewFindings = <
  Attempt extends { findings: Array<Pick<ProjectReviewFinding, "status">> },
>(
  attempts: Attempt[],
) =>
  attempts.reduce(
    (count, attempt) => count + attempt.findings.filter((finding) => finding.status === "open").length,
    0,
  );

const toSummary = (value: unknown): ProjectReviewAttemptSummary | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return {
      executiveSummary: String((value as { executiveSummary?: unknown }).executiveSummary ?? ""),
      maturityLevel: String((value as { maturityLevel?: unknown }).maturityLevel ?? ""),
      usabilityVerdict: String((value as { usabilityVerdict?: unknown }).usabilityVerdict ?? ""),
      biggestStrengths: Array.isArray((value as { biggestStrengths?: unknown }).biggestStrengths)
        ? ((value as { biggestStrengths: string[] }).biggestStrengths ?? [])
        : [],
      biggestRisks: Array.isArray((value as { biggestRisks?: unknown }).biggestRisks)
        ? ((value as { biggestRisks: string[] }).biggestRisks ?? [])
        : [],
      finalVerdict: ((value as { finalVerdict?: ProjectReviewAttemptSummary["finalVerdict"] }).finalVerdict ?? {
        documentationGoodEnough: false,
        testsGoodEnough: false,
        projectCompleteEnough: false,
        codeHasMajorIssues: true,
        confidence: "medium",
      }) as ProjectReviewAttemptSummary["finalVerdict"],
    };
  } catch {
    return null;
  }
};

const parseAutoAdvanceMeta = (value: unknown): AutoAdvanceMeta | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { batchToken?: unknown; sessionId?: unknown };
  return typeof candidate.batchToken === "string" && typeof candidate.sessionId === "string"
    ? {
        batchToken: candidate.batchToken,
        sessionId: candidate.sessionId,
      }
    : null;
};

export const createProjectReviewService = (
  db: AppDatabase,
  jobService: JobService,
  projectService: ProjectService,
  secretService: SecretService,
  githubService: GithubService,
) => ({
  async assertOwnedProject(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(eq(projectsTable.id, projectId), eq(projectsTable.ownerUserId, ownerUserId)),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    return project;
  },

  async finalizeMilestonePlan(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const [project] = await db
      .update(projectsTable)
      .set({
        milestonePlanStatus: "finalized",
        milestonePlanFinalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId))
      .returning();

    return project;
  },

  async reopenMilestonePlan(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const [project] = await db
      .update(projectsTable)
      .set({
        milestonePlanStatus: "open",
        milestonePlanFinalizedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId))
      .returning();

    return project;
  },

  async getActiveSession(projectId: string) {
    return db.query.projectReviewSessionsTable.findFirst({
      where: and(
        eq(projectReviewSessionsTable.projectId, projectId),
        inArray(projectReviewSessionsTable.status, [...ACTIVE_SESSION_STATUSES]),
      ),
      orderBy: [desc(projectReviewSessionsTable.createdAt)],
    });
  },

  async getLatestSession(projectId: string) {
    return db.query.projectReviewSessionsTable.findFirst({
      where: eq(projectReviewSessionsTable.projectId, projectId),
      orderBy: [desc(projectReviewSessionsTable.createdAt)],
    });
  },

  async reconcileStaleActiveSession(
    ownerUserId: string,
    projectId: string,
    message = "Project review stopped before the active job finished.",
  ) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const session = await this.getActiveSession(projectId);
    if (!session) {
      return false;
    }

    const [latestAttempt] = await db.query.projectReviewAttemptsTable.findMany({
      where: eq(projectReviewAttemptsTable.projectReviewSessionId, session.id),
      orderBy: [desc(projectReviewAttemptsTable.sequence)],
      limit: 1,
    });
    if (
      !latestAttempt ||
      (latestAttempt.status !== "queued" && latestAttempt.status !== "running")
    ) {
      return false;
    }

    const job = latestAttempt.jobId
      ? await db.query.jobsTable.findFirst({
          where: eq(jobsTable.id, latestAttempt.jobId),
        })
      : null;

    if (job?.status === "queued" || job?.status === "running") {
      return false;
    }

    await db
      .update(projectReviewAttemptsTable)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(projectReviewAttemptsTable.id, latestAttempt.id));
    await db
      .update(projectReviewSessionsTable)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(projectReviewSessionsTable.id, session.id));

    return true;
  },

  async listSessions(ownerUserId: string, projectId: string): Promise<ProjectReviewSession[]> {
    await this.assertOwnedProject(ownerUserId, projectId);
    const sessions = await db.query.projectReviewSessionsTable.findMany({
      where: eq(projectReviewSessionsTable.projectId, projectId),
      orderBy: [desc(projectReviewSessionsTable.createdAt)],
    });

    return Promise.all(sessions.map((session) => this.getSessionById(ownerUserId, session.id).then((result) => result.session!).catch(() => null))).then(
      (items) => items.filter((item): item is ProjectReviewSession => item !== null),
    );
  },

  async getSessionById(ownerUserId: string, sessionId: string): Promise<ProjectReviewDetailResponse> {
    const session = await db.query.projectReviewSessionsTable.findFirst({
      where: eq(projectReviewSessionsTable.id, sessionId),
    });

    if (!session) {
      throw new HttpError(404, "project_review_not_found", "Project review session not found.");
    }

    await this.assertOwnedProject(ownerUserId, session.projectId);

    const attempts = await db.query.projectReviewAttemptsTable.findMany({
      where: eq(projectReviewAttemptsTable.projectReviewSessionId, sessionId),
      orderBy: [asc(projectReviewAttemptsTable.sequence)],
    });
    const findings = await db.query.projectReviewFindingsTable.findMany({
      where: eq(projectReviewFindingsTable.projectId, session.projectId),
      orderBy: [asc(projectReviewFindingsTable.createdAt)],
    });
    const findingsByAttempt = new Map<string, ProjectReviewFinding[]>();

    for (const finding of findings) {
      const current = findingsByAttempt.get(finding.projectReviewAttemptId) ?? [];
      current.push(toFinding(finding));
      findingsByAttempt.set(finding.projectReviewAttemptId, current);
    }

    return projectReviewDetailResponseSchema.parse({
      session: projectReviewSessionSchema.parse({
        id: session.id,
        projectId: session.projectId,
        status: session.status,
        loopCount: session.loopCount,
        maxLoops: session.maxLoops,
        autoApplyFixes: session.autoApplyFixes,
        branchName: session.branchName ?? null,
        pullRequestUrl: session.pullRequestUrl ?? null,
        createdAt: session.createdAt.toISOString(),
        startedAt: session.startedAt?.toISOString() ?? null,
        completedAt: session.completedAt?.toISOString() ?? null,
        attempts: attempts.map((attempt) =>
          projectReviewAttemptSchema.parse({
            id: attempt.id,
            projectReviewSessionId: attempt.projectReviewSessionId,
            projectId: attempt.projectId,
            kind: attempt.kind,
            status: attempt.status,
            sequence: attempt.sequence,
            sandboxRunId: attempt.sandboxRunId ?? null,
            jobId: attempt.jobId ?? null,
            reportMarkdown: attempt.reportMarkdown ?? null,
            summary: toSummary(attempt.summary),
            findings: findingsByAttempt.get(attempt.id) ?? [],
            errorMessage: attempt.errorMessage ?? null,
            createdAt: attempt.createdAt.toISOString(),
            completedAt: attempt.completedAt?.toISOString() ?? null,
          }),
        ),
      }),
    });
  },

  async getLatestSessionDetail(ownerUserId: string, projectId: string): Promise<ProjectReviewDetailResponse> {
    await this.assertOwnedProject(ownerUserId, projectId);
    const session = await this.getLatestSession(projectId);
    if (!session) {
      return projectReviewDetailResponseSchema.parse({ session: null });
    }

    return this.getSessionById(ownerUserId, session.id);
  },

  async getPhase(ownerUserId: string, projectId: string): Promise<ProjectReviewPhase> {
    const project = await this.assertOwnedProject(ownerUserId, projectId);
    const latest = await this.getLatestSession(projectId);
    const latestDetail = latest ? await this.getSessionById(ownerUserId, latest.id) : null;
    const openFindingsCount = latestDetail?.session
      ? countOpenProjectReviewFindings(latestDetail.session.attempts)
      : 0;

    return projectReviewPhaseSchema.parse({
      finalized: project.milestonePlanStatus === "finalized",
      latestStatus: latest?.status ?? null,
      latestSessionId: latest?.id ?? null,
      openFindingsCount,
    });
  },

  async createAttempt(
    sessionId: string,
    projectId: string,
    kind: "review" | "fix",
    createdByUserId: string,
    sequence: number,
    autoAdvanceMeta?: AutoAdvanceMeta | null,
  ) {
    const [attempt] = await db
      .insert(projectReviewAttemptsTable)
      .values({
        id: generateId(),
        projectReviewSessionId: sessionId,
        projectId,
        kind,
        status: "queued",
        sequence,
        createdAt: new Date(),
      })
      .returning();

    const job = await jobService.createJob({
      createdByUserId,
      projectId,
      type: kind === "review" ? "RunProjectReview" : "RunProjectFix",
      inputs: {
        sessionId,
        attemptId: attempt.id,
        ...(autoAdvanceMeta ? { _autoAdvance: autoAdvanceMeta } : {}),
      },
    });

    const [updatedAttempt] = await db
      .update(projectReviewAttemptsTable)
      .set({ jobId: job.id })
      .where(eq(projectReviewAttemptsTable.id, attempt.id))
      .returning();

    return updatedAttempt;
  },

  async startReview(
    ownerUserId: string,
    projectId: string,
    _trigger: "manual" | "auto_advance" = "manual",
    maxLoops = DEFAULT_PROJECT_REVIEW_MAX_LOOPS,
    autoAdvanceMeta?: AutoAdvanceMeta | null,
  ) {
    const project = await this.assertOwnedProject(ownerUserId, projectId);
    if (project.milestonePlanStatus !== "finalized") {
      throw new HttpError(
        409,
        "milestone_plan_not_finalized",
        "Finalize milestone planning before starting the project review.",
      );
    }

    const active = await this.getActiveSession(projectId);
    if (active) {
      throw new HttpError(
        409,
        "project_review_already_running",
        "A project review session is already running.",
      );
    }

    const [session] = await db
      .insert(projectReviewSessionsTable)
      .values({
        id: generateId(),
        projectId,
        triggeredByUserId: ownerUserId,
        status: "queued_review",
        loopCount: 0,
        maxLoops,
        autoApplyFixes: true,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await this.createAttempt(session.id, projectId, "review", ownerUserId, 1, autoAdvanceMeta);
    return this.getSessionById(ownerUserId, session.id);
  },

  async retryFixes(
    ownerUserId: string,
    sessionId: string,
    maxLoops?: number,
    autoAdvanceMeta?: AutoAdvanceMeta | null,
  ) {
    const detail = await this.getSessionById(ownerUserId, sessionId);
    const session = detail.session;
    if (!session) {
      throw new HttpError(404, "project_review_not_found", "Project review session not found.");
    }
    if (session.status !== "needs_fixes" && session.status !== "failed") {
      throw new HttpError(409, "project_review_not_retryable", "This project review does not need a retry.");
    }
    if (maxLoops !== undefined && maxLoops <= session.loopCount) {
      throw new HttpError(
        409,
        "project_review_invalid_max_loops",
        "maxLoops must be greater than the current completed loop count.",
      );
    }

    const nextSequence = (session.attempts.at(-1)?.sequence ?? 0) + 1;
    const hasSuccessfulReviewAttempt = session.attempts.some(
      (attempt) => attempt.kind === "review" && attempt.status === "succeeded",
    );
    const nextAttemptKind = hasSuccessfulReviewAttempt ? "fix" : "review";
    await db
      .update(projectReviewSessionsTable)
      .set({
        status: nextAttemptKind === "fix" ? "queued_fix" : "queued_review",
        maxLoops: maxLoops ?? session.maxLoops,
        updatedAt: new Date(),
      })
      .where(eq(projectReviewSessionsTable.id, session.id));
    await this.createAttempt(
      session.id,
      session.projectId,
      nextAttemptKind,
      ownerUserId,
      nextSequence,
      autoAdvanceMeta,
    );
    return this.getSessionById(ownerUserId, session.id);
  },

  async getRetryMaxLoopsForAutoAdvance(ownerUserId: string, sessionId: string) {
    const detail = await this.getSessionById(ownerUserId, sessionId);
    const session = detail.session;
    if (!session) {
      throw new HttpError(404, "project_review_not_found", "Project review session not found.");
    }

    return session.maxLoops <= session.loopCount
      ? session.loopCount + PROJECT_REVIEW_RETRY_LOOP_INCREMENT
      : undefined;
  },

  async markAttemptRunning(attemptId: string, sandboxRunId: string) {
    const [attempt] = await db
      .update(projectReviewAttemptsTable)
      .set({
        status: "running",
        sandboxRunId,
      })
      .where(eq(projectReviewAttemptsTable.id, attemptId))
      .returning();

    if (!attempt) {
      throw new Error(`Project review attempt ${attemptId} not found.`);
    }

    await db
      .update(projectReviewSessionsTable)
      .set({
        status: attempt.kind === "review" ? "running_review" : "running_fix",
        updatedAt: new Date(),
      })
      .where(eq(projectReviewSessionsTable.id, attempt.projectReviewSessionId));

    return attempt;
  },

  async completeReviewAttempt(attemptId: string, reportMarkdown: string, reportJson: string, sandboxRun: { branchName: string | null; id: string; pullRequestUrl: string | null }) {
    const attempt = await db.query.projectReviewAttemptsTable.findFirst({
      where: eq(projectReviewAttemptsTable.id, attemptId),
    });
    if (!attempt) {
      throw new Error(`Project review attempt ${attemptId} not found.`);
    }

    const parsed = parseProjectReviewArtifact(reportJson);
    await db.delete(projectReviewFindingsTable).where(eq(projectReviewFindingsTable.projectReviewAttemptId, attemptId));
    if (parsed.findings.length > 0) {
      await db.insert(projectReviewFindingsTable).values(
        parsed.findings.map((finding) => ({
          id: generateId(),
          projectReviewAttemptId: attemptId,
          projectId: attempt.projectId,
          category: finding.category,
          severity: finding.severity,
          finding: finding.finding,
          evidence: finding.evidence,
          whyItMatters: finding.whyItMatters,
          recommendedImprovement: finding.recommendedImprovement,
          status: "open" as const,
          createdAt: new Date(),
        })),
      );
    }

    const summary = {
      executiveSummary: parsed.executiveSummary,
      maturityLevel: parsed.maturityLevel,
      usabilityVerdict: parsed.usabilityVerdict,
      biggestStrengths: parsed.biggestStrengths,
      biggestRisks: parsed.biggestRisks,
      finalVerdict: parsed.finalVerdict,
      engineeringQualityVerdict: parsed.engineeringQualityVerdict,
    };

    await db
      .update(projectReviewAttemptsTable)
      .set({
        status: "succeeded",
        reportMarkdown,
        summary,
        completedAt: new Date(),
      })
      .where(eq(projectReviewAttemptsTable.id, attemptId));

    const session = await db.query.projectReviewSessionsTable.findFirst({
      where: eq(projectReviewSessionsTable.id, attempt.projectReviewSessionId),
    });
    if (!session) {
      throw new Error(`Project review session ${attempt.projectReviewSessionId} not found.`);
    }

    const job = attempt.jobId
      ? await db.query.jobsTable.findFirst({
          where: eq(jobsTable.id, attempt.jobId),
        })
      : null;
    const autoAdvanceMeta = parseAutoAdvanceMeta(
      (job?.inputs as { _autoAdvance?: unknown } | null | undefined)?._autoAdvance,
    );

    const highOnlyPhase = isProjectReviewHighOnlyPhase(session.loopCount, session.maxLoops);
    const { blocking, ignored } = partitionProjectReviewFindings(parsed.findings, highOnlyPhase);

    if (ignored.length > 0) {
      await db
        .update(projectReviewFindingsTable)
        .set({
          status: "ignored",
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(projectReviewFindingsTable.projectReviewAttemptId, attemptId),
            inArray(
              projectReviewFindingsTable.severity,
              ignored.map((finding) => finding.severity),
            ),
            eq(projectReviewFindingsTable.status, "open"),
          ),
        );
    }

    if (blocking.length === 0) {
      await db
        .update(projectReviewSessionsTable)
        .set({
          status: "clear",
          branchName: sandboxRun.branchName ?? session.branchName,
          pullRequestUrl: sandboxRun.pullRequestUrl ?? session.pullRequestUrl,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectReviewSessionsTable.id, session.id));
      return { clear: true, findingCount: 0, sessionId: session.id };
    }

    if (session.loopCount >= session.maxLoops) {
      await db
        .update(projectReviewSessionsTable)
        .set({
          status: "needs_fixes",
          branchName: session.branchName ?? PROJECT_REVIEW_FIX_BRANCH,
          updatedAt: new Date(),
        })
        .where(eq(projectReviewSessionsTable.id, session.id));
      return { clear: false, findingCount: blocking.length, sessionId: session.id };
    }

    const nextSequence = attempt.sequence + 1;
    await db
      .update(projectReviewSessionsTable)
      .set({
        status: "queued_fix",
        branchName: session.branchName ?? PROJECT_REVIEW_FIX_BRANCH,
        updatedAt: new Date(),
      })
      .where(eq(projectReviewSessionsTable.id, session.id));

    const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, attempt.projectId) });
    if (!project) {
      throw new Error(`Project ${attempt.projectId} not found.`);
    }
    await this.createAttempt(
      session.id,
      attempt.projectId,
      "fix",
      project.ownerUserId,
      nextSequence,
      autoAdvanceMeta,
    );
    return { clear: false, findingCount: blocking.length, sessionId: session.id };
  },

  async completeFixAttempt(attemptId: string, sandboxRun: { branchName: string | null; pullRequestUrl: string | null }) {
    const attempt = await db.query.projectReviewAttemptsTable.findFirst({
      where: eq(projectReviewAttemptsTable.id, attemptId),
    });
    if (!attempt) {
      throw new Error(`Project review attempt ${attemptId} not found.`);
    }

    const session = await db.query.projectReviewSessionsTable.findFirst({
      where: eq(projectReviewSessionsTable.id, attempt.projectReviewSessionId),
    });
    if (!session) {
      throw new Error(`Project review session ${attempt.projectReviewSessionId} not found.`);
    }

    const job = attempt.jobId
      ? await db.query.jobsTable.findFirst({
          where: eq(jobsTable.id, attempt.jobId),
        })
      : null;
    const autoAdvanceMeta = parseAutoAdvanceMeta(
      (job?.inputs as { _autoAdvance?: unknown } | null | undefined)?._autoAdvance,
    );

    await db
      .update(projectReviewAttemptsTable)
      .set({
        status: "succeeded",
        completedAt: new Date(),
      })
      .where(eq(projectReviewAttemptsTable.id, attemptId));

    const unresolved = await db.query.projectReviewFindingsTable.findMany({
      where: and(
        eq(projectReviewFindingsTable.projectId, attempt.projectId),
        eq(projectReviewFindingsTable.status, "open"),
      ),
    });
    if (unresolved.length > 0) {
      await db
        .update(projectReviewFindingsTable)
        .set({
          status: "superseded",
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(projectReviewFindingsTable.projectId, attempt.projectId),
            eq(projectReviewFindingsTable.status, "open"),
          ),
        );
    }

    const nextSequence = attempt.sequence + 1;
    await db
      .update(projectReviewSessionsTable)
      .set({
        status: "queued_review",
        loopCount: session.loopCount + 1,
        branchName: sandboxRun.branchName ?? session.branchName ?? PROJECT_REVIEW_FIX_BRANCH,
        pullRequestUrl: sandboxRun.pullRequestUrl ?? session.pullRequestUrl,
        updatedAt: new Date(),
      })
      .where(eq(projectReviewSessionsTable.id, session.id));

    const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, attempt.projectId) });
    if (!project) {
      throw new Error(`Project ${attempt.projectId} not found.`);
    }
    await this.createAttempt(
      session.id,
      attempt.projectId,
      "review",
      project.ownerUserId,
      nextSequence,
      autoAdvanceMeta,
    );
    return { sessionId: session.id };
  },

  async mergeFixPullRequest(ownerUserId: string, sessionId: string) {
    const detail = await this.getSessionById(ownerUserId, sessionId);
    const session = detail.session;

    if (!session) {
      throw new HttpError(404, "project_review_not_found", "Project review session not found.");
    }
    if (!session.branchName) {
      return { merged: false };
    }

    const repo = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, session.projectId),
    });
    if (!repo?.owner || !repo.name) {
      throw new HttpError(409, "project_review_repo_missing", "Project review merge requires a configured repository.");
    }

    const env = await secretService.buildSecretEnvMap(ownerUserId, session.projectId);
    if (!env.GITHUB_PAT) {
      throw new HttpError(409, "github_pat_required", "A GitHub PAT is required to merge the review pull request.");
    }

    const pullRequest = await githubService.findOpenPullRequestForHead({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      head: session.branchName,
    });

    if (!pullRequest) {
      return { merged: false };
    }

    await githubService.mergePullRequest({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      pullNumber: pullRequest.number,
      method: "merge",
    });

    await githubService.deleteBranch({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      branch: session.branchName,
    }).catch(() => undefined);

    return { merged: true, pullRequestUrl: pullRequest.url };
  },

  async markProjectCompleted(ownerUserId: string, projectId: string) {
    return projectService.updateOwnedProject(ownerUserId, projectId, {
      state: "COMPLETED",
    });
  },

  async failAttemptByJobId(jobId: string, message: string) {
    const attempt = await db.query.projectReviewAttemptsTable.findFirst({
      where: eq(projectReviewAttemptsTable.jobId, jobId),
    });
    if (!attempt) {
      return;
    }

    await db
      .update(projectReviewAttemptsTable)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(projectReviewAttemptsTable.id, attempt.id));
    await db
      .update(projectReviewSessionsTable)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(projectReviewSessionsTable.id, attempt.projectReviewSessionId));
  },
});

export type ProjectReviewService = ReturnType<typeof createProjectReviewService>;
