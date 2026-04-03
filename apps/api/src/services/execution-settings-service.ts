import type { ExecutionSettings } from "@quayboard/shared";

import type { SettingsService } from "./settings-service.js";

const EXECUTION_SETTINGS_KEY = "system.execution.defaults";

export const createExecutionSettingsService = (
  settingsService: SettingsService,
  defaults: ExecutionSettings,
) => ({
  async get() {
    const stored = await settingsService.getSystemSetting<ExecutionSettings>(
      EXECUTION_SETTINGS_KEY,
    );

    return {
      ...defaults,
      ...(stored ?? {}),
    };
  },

  async update(next: ExecutionSettings) {
    await settingsService.upsertSystemSetting(EXECUTION_SETTINGS_KEY, next);
    return this.get();
  },
});

export type ExecutionSettingsService = ReturnType<
  typeof createExecutionSettingsService
>;
