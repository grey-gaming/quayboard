import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Job } from "@quayboard/shared";

import type { AppDatabase } from "../../db/client.js";
import { jobsTable, projectsTable } from "../../db/schema.js";
import { generateId } from "../ids.js";
import { HttpError } from "../http-error.js";

const toJob = (record: typeof jobsTable.$inferSelect): Job => ({
  id: record.id,
  projectId: record.projectId ?? null,
  type: record.type,
  status: record.status,
  inputs: record.inputs,
  outputs: record.outputs ?? null,
  error: record.error ?? null,
  queuedAt: record.queuedAt.toISOString(),
  startedAt: record.startedAt?.toISOString() ?? null,
  completedAt: record.completedAt?.toISOString() ?? null,
});

export type JobCreateInput = {
  createdByUserId: string;
  inputs?: unknown;
  projectId: string | null;
  type: string;
};

type JobStatus = (typeof jobsTable.$inferSelect)["status"];

type JobTerminalError = {
  message: string;
  code?: string;
};

type ActiveJobConflict = {
  code: string;
  message: string;
};

type ScopedJobCreateInput = Omit<JobCreateInput, "projectId"> & {
  activeConflict: ActiveJobConflict;
  kind: "ux" | "tech";
  projectId: string;
};

export const createJobService = (db: AppDatabase) => ({
  async createJob(input: JobCreateInput) {
    const now = new Date();
    const [job] = await db
      .insert(jobsTable)
      .values({
        id: generateId(),
        projectId: input.projectId,
        createdByUserId: input.createdByUserId,
        type: input.type,
        status: "queued",
        inputs: input.inputs ?? {},
        queuedAt: now,
      })
      .returning();

    return toJob(job);
  },

  async createJobIfNoActiveProjectJobOfSameKind(input: ScopedJobCreateInput) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('jobs'), hashtext(${`${input.projectId}:${input.type}:${input.kind}`}))`,
      );

      const [existingJob] = await tx
        .select()
        .from(jobsTable)
        .where(
          and(
            eq(jobsTable.projectId, input.projectId),
            eq(jobsTable.type, input.type),
            inArray(jobsTable.status, ["queued", "running"]),
            sql`${jobsTable.inputs} ->> 'kind' = ${input.kind}`,
          ),
        )
        .orderBy(desc(jobsTable.queuedAt))
        .limit(1);

      if (existingJob) {
        throw new HttpError(409, input.activeConflict.code, input.activeConflict.message);
      }

      const now = new Date();
      const [job] = await tx
        .insert(jobsTable)
        .values({
          id: generateId(),
          projectId: input.projectId,
          createdByUserId: input.createdByUserId,
          type: input.type,
          status: "queued",
          inputs: input.inputs ?? {},
          queuedAt: now,
        })
        .returning();

      return toJob(job);
    });
  },

  async claimNextQueuedJob() {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(and(eq(jobsTable.status, "queued"), isNull(jobsTable.startedAt)))
      .orderBy(asc(jobsTable.queuedAt))
      .limit(1);

    if (!job) {
      return null;
    }

    const [claimed] = await db
      .update(jobsTable)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(and(eq(jobsTable.id, job.id), eq(jobsTable.status, "queued")))
      .returning();

    return claimed ? toJob(claimed) : null;
  },

  async markSucceeded(jobId: string, outputs: unknown) {
    const [job] = await db
      .update(jobsTable)
      .set({
        status: "succeeded",
        outputs,
        error: null,
        completedAt: new Date(),
      })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "running")))
      .returning();

    if (job) {
      return toJob(job);
    }

    const existingJob = await db.query.jobsTable.findFirst({
      where: eq(jobsTable.id, jobId),
    });

    if (!existingJob) {
      throw new Error(`Job ${jobId} not found.`);
    }

    return toJob(existingJob);
  },

  async markFailed(jobId: string, error: unknown) {
    const [job] = await db
      .update(jobsTable)
      .set({
        status: "failed",
        error,
        completedAt: new Date(),
      })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "running")))
      .returning();

    if (job) {
      return toJob(job);
    }

    const existingJob = await db.query.jobsTable.findFirst({
      where: eq(jobsTable.id, jobId),
    });

    if (!existingJob) {
      throw new Error(`Job ${jobId} not found.`);
    }

    return toJob(existingJob);
  },

  async cancelRunningJobs(error: JobTerminalError) {
    const cancelledJobs = await db
      .update(jobsTable)
      .set({
        status: "cancelled",
        error,
        completedAt: new Date(),
      })
      .where(eq(jobsTable.status, "running"))
      .returning();

    return cancelledJobs.map(toJob);
  },

  async getOwnedJob(ownerUserId: string, jobId: string) {
    const [job] = await db
      .select({
        job: jobsTable,
        ownerUserId: projectsTable.ownerUserId,
      })
      .from(jobsTable)
      .leftJoin(projectsTable, eq(projectsTable.id, jobsTable.projectId))
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job || (job.ownerUserId && job.ownerUserId !== ownerUserId)) {
      throw new HttpError(404, "job_not_found", "Job not found.");
    }

    return toJob(job.job);
  },

  async listJobsForProject(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    const jobs = await db.query.jobsTable.findMany({
      where: eq(jobsTable.projectId, projectId),
      orderBy: [desc(jobsTable.queuedAt)],
    });

    return jobs.map(toJob);
  },

  async listOwnedJobs(ownerUserId: string) {
    const jobs = await db
      .select({
        job: jobsTable,
      })
      .from(jobsTable)
      .innerJoin(projectsTable, eq(projectsTable.id, jobsTable.projectId))
      .where(eq(projectsTable.ownerUserId, ownerUserId))
      .orderBy(desc(jobsTable.queuedAt));

    return jobs.map(({ job }) => toJob(job));
  },

  async findActiveProjectJobByTypeAndKind(
    projectId: string,
    type: string,
    kind: "ux" | "tech",
    statuses: JobStatus[] = ["queued", "running"],
  ) {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.projectId, projectId),
          eq(jobsTable.type, type),
          inArray(jobsTable.status, statuses),
          sql`${jobsTable.inputs} ->> 'kind' = ${kind}`,
        ),
      )
      .orderBy(desc(jobsTable.queuedAt))
      .limit(1);

    return job ? toJob(job) : null;
  },

  async getRawJob(jobId: string) {
    return db.query.jobsTable.findFirst({
      where: eq(jobsTable.id, jobId),
    });
  },
});

export type JobService = ReturnType<typeof createJobService>;
