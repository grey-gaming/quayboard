import { loadEnv } from "./load-env.js";

loadEnv();

import { z } from "zod";

const runtimeEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
  ARTIFACT_STORAGE_PATH: z.string().default("/tmp/quayboard-artifacts"),
  DOCKER_HOST: z.string().optional(),
  OLLAMA_HOST: z.string().url().default("http://127.0.0.1:11434"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
});

type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

const parseEnv = (): RuntimeEnv => runtimeEnvSchema.parse(process.env);

const requireValue = (value: string | undefined, message: string) => {
  if (!value) {
    throw new Error(message);
  }

  return value;
};

export const readHttpConfig = () => {
  const env = parseEnv();

  return {
    apiPort: env.API_PORT,
    corsOrigin: env.CORS_ORIGIN,
  };
};

export const readDatabaseUrl = () => {
  const env = parseEnv();

  return requireValue(
    env.DATABASE_URL,
    "DATABASE_URL is required for database access.",
  );
};

export const readSecretsEncryptionKey = () => {
  const env = parseEnv();

  return requireValue(
    env.SECRETS_ENCRYPTION_KEY,
    "SECRETS_ENCRYPTION_KEY is required for secrets access.",
  );
};

export const readAppConfig = () => {
  const env = parseEnv();

  return {
    artifactStoragePath: env.ARTIFACT_STORAGE_PATH,
    dockerHost: env.DOCKER_HOST ?? null,
    ollamaHost: env.OLLAMA_HOST,
    openAiBaseUrl: env.OPENAI_BASE_URL,
  };
};
