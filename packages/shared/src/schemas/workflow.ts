import { z } from "zod";

export const phaseGateItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
});

export const phaseGateSchema = z.object({
  phase: z.string().min(1),
  passed: z.boolean(),
  items: z.array(phaseGateItemSchema),
});

export const phaseGatesResponseSchema = z.object({
  phases: z.array(phaseGateSchema),
});

export type PhaseGatesResponse = z.infer<typeof phaseGatesResponseSchema>;

export const nextActionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  href: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
});

export const nextActionsResponseSchema = z.object({
  actions: z.array(nextActionSchema),
});

export type NextActionsResponse = z.infer<typeof nextActionsResponseSchema>;
