import { and, eq } from "drizzle-orm";

import type { CreateProjectRequest, Project } from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { projectCountersTable, projectsTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const toProject = (record: typeof projectsTable.$inferSelect): Project => ({
  id: record.id,
  name: record.name,
  description: record.description,
  state: record.state,
  ownerUserId: record.ownerUserId,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export const createProjectService = (db: AppDatabase) => ({
  async createProject(ownerUserId: string, input: CreateProjectRequest) {
    const now = new Date();
    const [project] = await db
      .insert(projectsTable)
      .values({
        id: generateId(),
        ownerUserId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        state: "EMPTY",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(projectCountersTable).values({
      projectId: project.id,
      featureCounter: 0,
      taskCounter: 0,
      updatedAt: now,
    });

    return toProject(project);
  },

  async listProjects(ownerUserId: string) {
    const projects = await db.query.projectsTable.findMany({
      where: eq(projectsTable.ownerUserId, ownerUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return projects.map(toProject);
  },

  async getOwnedProject(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.ownerUserId, ownerUserId),
        eq(projectsTable.id, projectId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    return toProject(project);
  },
});

export type ProjectService = ReturnType<typeof createProjectService>;
