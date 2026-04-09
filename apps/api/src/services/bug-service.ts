import { and, desc, eq, inArray } from "drizzle-orm";

import {
  bugDetailResponseSchema,
  bugListResponseSchema,
  bugReportSchema,
  createBugRequestSchema,
  updateBugRequestSchema,
  type BugReport,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  bugReportsTable,
  jobsTable,
  projectsTable,
  reposTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { FeatureService } from "./feature-service.js";
import type { GithubService } from "./github-service.js";
import type { JobService } from "./jobs/job-service.js";
import type { ProjectService } from "./project-service.js";
import type { SecretService } from "./secret-service.js";
import type { SseHub } from "./sse.js";
import type { TaskPlanningService } from "./task-planning-service.js";

const toBugReport = (record: typeof bugReportsTable.$inferSelect): BugReport =>
  bugReportSchema.parse({
    id: record.id,
    projectId: record.projectId,
    featureId: record.featureId ?? null,
    implementationRecordId: record.implementationRecordId ?? null,
    description: record.description,
    status: record.status,
    reportedByUserId: record.reportedByUserId,
    latestFixJobId: record.latestFixJobId ?? null,
    latestFixSandboxRunId: record.latestFixSandboxRunId ?? null,
    latestFixPullRequestUrl: record.latestFixPullRequestUrl ?? null,
    lastFixError: record.lastFixError ?? null,
    fixedAt: record.fixedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

export const createBugService = (
  db: AppDatabase,
  projectService: ProjectService,
  featureService: FeatureService,
  taskPlanningService: TaskPlanningService,
  jobService: JobService,
  secretService: SecretService,
  githubService: GithubService,
  sseHub: SseHub,
) => ({
  publishProjectUpdate(ownerUserId: string, projectId: string) {
    sseHub.publish(ownerUserId, "project:updated", {
      type: "project:updated",
      projectId,
      resource: "bug",
    });
  },

  async assertOwnedProject(ownerUserId: string, projectId: string) {
    return projectService.getOwnedProjectRecord(ownerUserId, projectId);
  },

  async getScopedFeature(ownerUserId: string, projectId: string, featureId: string) {
    const feature = await featureService.get(ownerUserId, featureId);
    if (feature.projectId !== projectId) {
      throw new HttpError(404, "feature_not_found", "Feature not found.");
    }
    return feature;
  },

  async resolveImplementationRecordId(ownerUserId: string, featureId?: string | null) {
    if (!featureId) {
      return null;
    }

    const records = await taskPlanningService.getImplementationRecords(ownerUserId, featureId);
    return records[0]?.id ?? null;
  },

  async getOwnedBug(ownerUserId: string, bugId: string) {
    const bug = await db.query.bugReportsTable.findFirst({
      where: eq(bugReportsTable.id, bugId),
    });

    if (!bug) {
      throw new HttpError(404, "bug_not_found", "Bug not found.");
    }

    await this.assertOwnedProject(ownerUserId, bug.projectId);
    return bug;
  },

  async listBugs(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const bugs = await db.query.bugReportsTable.findMany({
      where: eq(bugReportsTable.projectId, projectId),
      orderBy: [desc(bugReportsTable.updatedAt), desc(bugReportsTable.createdAt)],
    });

    return bugListResponseSchema.parse({ bugs: bugs.map(toBugReport) });
  },

  async getBug(ownerUserId: string, bugId: string) {
    const bug = await this.getOwnedBug(ownerUserId, bugId);
    return bugDetailResponseSchema.parse({ bug: toBugReport(bug) });
  },

  async createBug(
    ownerUserId: string,
    projectId: string,
    input: unknown,
  ) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const payload = createBugRequestSchema.parse(input);

    if (payload.featureId) {
      await this.getScopedFeature(ownerUserId, projectId, payload.featureId);
    }

    const now = new Date();
    const [bug] = await db
      .insert(bugReportsTable)
      .values({
        id: generateId(),
        projectId,
        featureId: payload.featureId ?? null,
        implementationRecordId: await this.resolveImplementationRecordId(ownerUserId, payload.featureId),
        description: payload.description,
        status: "open",
        reportedByUserId: ownerUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    this.publishProjectUpdate(ownerUserId, projectId);
    return bugReportSchema.parse(toBugReport(bug));
  },

  async updateBug(
    ownerUserId: string,
    bugId: string,
    input: unknown,
  ) {
    const bug = await this.getOwnedBug(ownerUserId, bugId);
    if (bug.status !== "open") {
      throw new HttpError(409, "bug_not_editable", "Only open bugs can be edited.");
    }

    const payload = updateBugRequestSchema.parse(input);
    const featureId = payload.featureId === undefined ? bug.featureId : payload.featureId;

    if (featureId) {
      await this.getScopedFeature(ownerUserId, bug.projectId, featureId);
    }

    const [updated] = await db
      .update(bugReportsTable)
      .set({
        featureId: featureId ?? null,
        implementationRecordId: await this.resolveImplementationRecordId(ownerUserId, featureId),
        description: payload.description ?? bug.description,
        updatedAt: new Date(),
      })
      .where(eq(bugReportsTable.id, bug.id))
      .returning();

    this.publishProjectUpdate(ownerUserId, bug.projectId);
    return bugReportSchema.parse(toBugReport(updated));
  },

  async countOpenBugs(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const bugs = await db.query.bugReportsTable.findMany({
      where: and(
        eq(bugReportsTable.projectId, projectId),
        inArray(bugReportsTable.status, ["open", "in_progress"]),
      ),
    });
    return bugs.length;
  },

  async startFix(ownerUserId: string, bugId: string) {
    const bug = await this.getOwnedBug(ownerUserId, bugId);
    if (bug.status !== "open") {
      throw new HttpError(409, "bug_not_fixable", "Only open bugs can be fixed.");
    }

    if (bug.latestFixJobId) {
      const existingJob = await jobService.getRawJob(bug.latestFixJobId);
      if (existingJob && (existingJob.status === "queued" || existingJob.status === "running")) {
        throw new HttpError(409, "bug_fix_already_running", "A fix is already running for this bug.");
      }
    }

    const job = await jobService.createJob({
      createdByUserId: ownerUserId,
      projectId: bug.projectId,
      type: "RunBugFix",
      inputs: { bugId: bug.id },
    });

    const [updated] = await db
      .update(bugReportsTable)
      .set({
        status: "in_progress",
        latestFixJobId: job.id,
        lastFixError: null,
        updatedAt: new Date(),
      })
      .where(eq(bugReportsTable.id, bug.id))
      .returning();

    this.publishProjectUpdate(ownerUserId, bug.projectId);
    return bugReportSchema.parse(toBugReport(updated));
  },

  async attachSandboxRun(bugId: string, sandboxRunId: string) {
    await db
      .update(bugReportsTable)
      .set({
        latestFixSandboxRunId: sandboxRunId,
        updatedAt: new Date(),
      })
      .where(eq(bugReportsTable.id, bugId));
  },

  async completeFix(ownerUserId: string, bugId: string, input: {
    pullRequestUrl: string | null;
    sandboxRunId: string;
  }) {
    const bug = await this.getOwnedBug(ownerUserId, bugId);
    const [updated] = await db
      .update(bugReportsTable)
      .set({
        status: "fixed",
        latestFixSandboxRunId: input.sandboxRunId,
        latestFixPullRequestUrl: input.pullRequestUrl,
        lastFixError: null,
        fixedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bugReportsTable.id, bug.id))
      .returning();

    this.publishProjectUpdate(ownerUserId, bug.projectId);
    return updated;
  },

  async failFix(ownerUserId: string, bugId: string, message: string, sandboxRunId?: string | null) {
    const bug = await this.getOwnedBug(ownerUserId, bugId);
    const [updated] = await db
      .update(bugReportsTable)
      .set({
        status: "open",
        latestFixSandboxRunId: sandboxRunId ?? bug.latestFixSandboxRunId,
        lastFixError: message,
        updatedAt: new Date(),
      })
      .where(eq(bugReportsTable.id, bug.id))
      .returning();

    this.publishProjectUpdate(ownerUserId, bug.projectId);
    return updated;
  },

  async reopenInterruptedFixes(jobIds: string[], message: string) {
    if (jobIds.length === 0) {
      return [];
    }

    const reopened = await db
      .update(bugReportsTable)
      .set({
        status: "open",
        lastFixError: message,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(bugReportsTable.latestFixJobId, jobIds),
          eq(bugReportsTable.status, "in_progress"),
        ),
      )
      .returning();

    if (reopened.length === 0) {
      return [];
    }

    const distinctProjectIds = [...new Set(reopened.map((bug) => bug.projectId))];
    const projects = await db.query.projectsTable.findMany({
      where: inArray(projectsTable.id, distinctProjectIds),
    });

    for (const project of projects) {
      this.publishProjectUpdate(project.ownerUserId, project.id);
    }

    return reopened.map(toBugReport);
  },

  async reconcileStaleInProgressFixes() {
    const staleBugs = await db.query.bugReportsTable.findMany({
      where: eq(bugReportsTable.status, "in_progress"),
      orderBy: [desc(bugReportsTable.updatedAt)],
    });

    if (staleBugs.length === 0) {
      return [];
    }

    const latestJobIds = staleBugs
      .map((bug) => bug.latestFixJobId)
      .filter((jobId): jobId is string => Boolean(jobId));

    const jobs = latestJobIds.length
      ? await db.query.jobsTable.findMany({
          where: inArray(jobsTable.id, latestJobIds),
        })
      : [];
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    const staleBugIds = staleBugs
      .filter((bug) => {
        const latestJob = bug.latestFixJobId ? jobsById.get(bug.latestFixJobId) ?? null : null;
        return !latestJob || (latestJob.status !== "queued" && latestJob.status !== "running");
      })
      .map((bug) => bug.id);

    if (staleBugIds.length === 0) {
      return [];
    }

    const reopened = await db
      .update(bugReportsTable)
      .set({
        status: "open",
        lastFixError: "The previous fix run is no longer active. Start a new fix run if needed.",
        updatedAt: new Date(),
      })
      .where(inArray(bugReportsTable.id, staleBugIds))
      .returning();

    const distinctProjectIds = [...new Set(reopened.map((bug) => bug.projectId))];
    const projects = await db.query.projectsTable.findMany({
      where: inArray(projectsTable.id, distinctProjectIds),
    });

    for (const project of projects) {
      this.publishProjectUpdate(project.ownerUserId, project.id);
    }

    return reopened.map(toBugReport);
  },

  async mergeFixPullRequest(ownerUserId: string, bugId: string, branchName: string) {
    const bug = await this.getOwnedBug(ownerUserId, bugId);
    const repo = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, bug.projectId),
    });

    if (!repo?.owner || !repo.name) {
      throw new HttpError(409, "project_repo_required", "A verified GitHub repository is required to merge the bug fix.");
    }

    const env = await secretService.buildSecretEnvMap(ownerUserId, bug.projectId);
    if (!env.GITHUB_PAT) {
      throw new HttpError(409, "github_pat_required", "A GitHub PAT is required to merge the bug fix pull request.");
    }

    const pullRequest = await githubService.findOpenPullRequestForHead({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      head: branchName,
    });

    if (!pullRequest) {
      return { merged: false, pullRequestUrl: null };
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
      branch: branchName,
    }).catch(() => undefined);

    return { merged: true, pullRequestUrl: pullRequest.url };
  },
});

export type BugService = ReturnType<typeof createBugService>;
