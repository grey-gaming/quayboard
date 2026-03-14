import { loadEnv } from "./load-env.js";

loadEnv();

import { z } from "zod";

const runtimeEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
});

type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

const parseEnv = (): RuntimeEnv => runtimeEnvSchema.parse(process.env);

export const readHttpConfig = () => {
  const env = parseEnv();

  return {
    apiPort: env.API_PORT,
    corsOrigin: env.CORS_ORIGIN,
  };
};

export const readDatabaseUrl = () => {
  const env = parseEnv();

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database migrations.");
  }

  return env.DATABASE_URL;
};
