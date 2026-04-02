import { and, eq, isNull } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { settingsTable } from "../db/schema.js";
import { generateId } from "./ids.js";

export const createSettingsService = (db: AppDatabase) => ({
  async getScopedSetting<T>(scope: "project" | "system", scopeId: string | null, key: string) {
    const setting = await db.query.settingsTable.findFirst({
      where: and(
        eq(settingsTable.scope, scope),
        scopeId === null ? isNull(settingsTable.scopeId) : eq(settingsTable.scopeId, scopeId),
        eq(settingsTable.key, key),
      ),
    });

    return (setting?.value ?? null) as T | null;
  },

  async upsertScopedSetting<T>(scope: "project" | "system", scopeId: string | null, key: string, value: T) {
    const now = new Date();
    const existing = await db.query.settingsTable.findFirst({
      where: and(
        eq(settingsTable.scope, scope),
        scopeId === null ? isNull(settingsTable.scopeId) : eq(settingsTable.scopeId, scopeId),
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
        scope,
        scopeId,
        key,
        value,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  },

  async getProjectSetting<T>(projectId: string, key: string) {
    return this.getScopedSetting<T>("project", projectId, key);
  },

  async upsertProjectSetting<T>(projectId: string, key: string, value: T) {
    return this.upsertScopedSetting("project", projectId, key, value);
  },

  async getSystemSetting<T>(key: string) {
    return this.getScopedSetting<T>("system", null, key);
  },

  async upsertSystemSetting<T>(key: string, value: T) {
    return this.upsertScopedSetting("system", null, key, value);
  },
});

export type SettingsService = ReturnType<typeof createSettingsService>;
