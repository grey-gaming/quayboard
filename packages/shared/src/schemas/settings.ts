import { z } from "zod";

export const settingScopeSchema = z.enum(["system", "user", "org", "project"]);

export type SettingScope = z.infer<typeof settingScopeSchema>;

export const settingSchema = z.object({
  id: z.string().uuid(),
  scope: settingScopeSchema,
  scopeId: z.string().uuid().nullable(),
  key: z.string().min(1),
  value: z.unknown(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Setting = z.infer<typeof settingSchema>;
