import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const healthResponseJsonSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      const: "ok",
    },
  },
  required: ["status"],
  additionalProperties: false,
} as const;
