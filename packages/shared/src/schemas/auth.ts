import { z } from "zod";

import { userSchema } from "./users.js";

export const authCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export const registerRequestSchema = authCredentialsSchema.extend({
  displayName: z.string().min(1).max(120),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = authCredentialsSchema;

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserResponseSchema = z.object({
  user: userSchema,
});

export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
