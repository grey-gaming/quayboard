import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { settingsTable } from "../db/schema.js";
import { generateId } from "./ids.js";

export const createSettingsService = (db: AppDatabase) => ({
  async getProjectSetting<T>(projectId: string, key: string) {
    const setting = await db.query.settingsTable.findFirst({
      where: and(
        eq(settingsTable.scope, "project"),
        eq(settingsTable.scopeId, projectId),
        eq(settingsTable.key, key),
      ),
    });

    return (setting?.value ?? null) as T | null;
  },

  async upsertProjectSetting<T>(projectId: string, key: string, value: T) {
    const now = new Date();
    const existing = await db.query.settingsTable.findFirst({
      where: and(
        eq(settingsTable.scope, "project"),
        eq(settingsTable.scopeId, projectId),
        eq(settingsTable.key, key),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(settingsTable)
        .set({ value, updatedAt: now })
        .where(eq(settingsTable.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(settingsTable)
      .values({
        id: generateId(),
        scope: "project",
        scopeId: projectId,
        key,
        value,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  },
});

export type SettingsService = ReturnType<typeof createSettingsService>;
