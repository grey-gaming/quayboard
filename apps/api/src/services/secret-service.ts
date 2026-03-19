import { and, eq } from "drizzle-orm";

import type {
  CreateSecretRequest,
  SecretMetadata,
  SecretType,
  UpdateSecretRequest,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { encryptedSecretsTable, projectsTable } from "../db/schema.js";
import { isUniqueViolationError } from "./db-errors.js";
import type { SecretsCrypto } from "./secrets-crypto.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const maskSecret = (value: string) => {
  const visibleChars = value.length <= 4 ? 0 : 4;
  const suffix = visibleChars === 0 ? "" : value.slice(-visibleChars);

  return `${"*".repeat(Math.max(8, value.length))}${suffix}`;
};

const toSecretMetadata = (
  secret: typeof encryptedSecretsTable.$inferSelect,
): SecretMetadata => ({
  id: secret.id,
  projectId: secret.projectId,
  type: secret.type,
  maskedIdentifier: secret.maskedIdentifier,
  createdAt: secret.createdAt.toISOString(),
  rotatedAt: secret.rotatedAt?.toISOString() ?? null,
});

const SECRET_ENV_NAMES: Record<SecretType, string> = {
  github_pat: "GITHUB_PAT",
  llm_api_key: "LLM_API_KEY",
  oauth_token: "OAUTH_TOKEN",
};

export const createSecretService = (
  db: AppDatabase,
  crypto: SecretsCrypto,
  projectService: {
    getOwnedProject(ownerUserId: string, projectId: string): Promise<unknown>;
  },
) => ({
  async createSecret(ownerUserId: string, projectId: string, input: CreateSecretRequest) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const now = new Date();

    const [existingSecret] = await db
      .select()
      .from(encryptedSecretsTable)
      .where(
        and(
          eq(encryptedSecretsTable.projectId, projectId),
          eq(encryptedSecretsTable.type, input.type),
        ),
      )
      .limit(1);

    if (existingSecret) {
      throw new HttpError(
        409,
        "secret_exists",
        "A secret of this type already exists for the project.",
      );
    }

    let secret;
    try {
      [secret] = await db
        .insert(encryptedSecretsTable)
        .values({
          id: generateId(),
          projectId,
          type: input.type,
          maskedIdentifier: maskSecret(input.value),
          encryptedValue: crypto.encrypt(input.value),
          createdAt: now,
          rotatedAt: null,
        })
        .returning();
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new HttpError(
          409,
          "secret_exists",
          "A secret of this type already exists for the project.",
        );
      }

      throw error;
    }

    return toSecretMetadata(secret);
  },

  async upsertSecret(ownerUserId: string, projectId: string, input: CreateSecretRequest) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const now = new Date();

    const [existingSecret] = await db
      .select()
      .from(encryptedSecretsTable)
      .where(
        and(
          eq(encryptedSecretsTable.projectId, projectId),
          eq(encryptedSecretsTable.type, input.type),
        ),
      )
      .limit(1);

    if (!existingSecret) {
      return this.createSecret(ownerUserId, projectId, input);
    }

    const [updatedSecret] = await db
      .update(encryptedSecretsTable)
      .set({
        encryptedValue: crypto.encrypt(input.value),
        maskedIdentifier: maskSecret(input.value),
        rotatedAt: now,
      })
      .where(eq(encryptedSecretsTable.id, existingSecret.id))
      .returning();

    return toSecretMetadata(updatedSecret);
  },

  async listSecrets(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const secrets = await db.query.encryptedSecretsTable.findMany({
      where: eq(encryptedSecretsTable.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return secrets.map(toSecretMetadata);
  },

  async updateSecret(ownerUserId: string, secretId: string, input: UpdateSecretRequest) {
    const [secret] = await db
      .select({
        projectId: encryptedSecretsTable.projectId,
        record: encryptedSecretsTable,
        ownerUserId: projectsTable.ownerUserId,
      })
      .from(encryptedSecretsTable)
      .innerJoin(projectsTable, eq(projectsTable.id, encryptedSecretsTable.projectId))
      .where(eq(encryptedSecretsTable.id, secretId))
      .limit(1);

    if (!secret || secret.ownerUserId !== ownerUserId) {
      throw new HttpError(404, "secret_not_found", "Secret not found.");
    }

    if (input.revoke === true) {
      await db
        .delete(encryptedSecretsTable)
        .where(eq(encryptedSecretsTable.id, secretId));

      return null;
    }

    const [updatedSecret] = await db
      .update(encryptedSecretsTable)
      .set({
        encryptedValue: crypto.encrypt(input.value!),
        maskedIdentifier: maskSecret(input.value!),
        rotatedAt: new Date(),
      })
      .where(eq(encryptedSecretsTable.id, secretId))
      .returning();

    return toSecretMetadata(updatedSecret);
  },

  async buildSecretEnvMap(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const secrets = await db.query.encryptedSecretsTable.findMany({
      where: eq(encryptedSecretsTable.projectId, projectId),
    });

    return Object.fromEntries(
      secrets.map((secret) => [
        SECRET_ENV_NAMES[secret.type],
        crypto.decrypt(secret.encryptedValue),
      ]),
    );
  },
});

export type SecretService = ReturnType<typeof createSecretService>;
