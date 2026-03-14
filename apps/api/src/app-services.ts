import { createPostgresDatabase, type AppDatabase } from "./db/client.js";
import { createAuthService, type AuthService } from "./services/auth-service.js";
import {
  createProjectService,
  type ProjectService,
} from "./services/project-service.js";
import {
  createSecretService,
  type SecretService,
} from "./services/secret-service.js";
import {
  createSecretsCrypto,
  type SecretsCrypto,
} from "./services/secrets-crypto.js";
import { createSseHub, type SseHub } from "./services/sse.js";

export type AppServices = {
  authService: AuthService;
  db: AppDatabase;
  projectService: ProjectService;
  secretService: SecretService;
  secretsCrypto: SecretsCrypto;
  sseHub: SseHub;
};

export const createAppServices = (
  databaseUrl: string,
  secretsEncryptionKey: string,
) => {
  const { client, db } = createPostgresDatabase(databaseUrl);
  const secretsCrypto = createSecretsCrypto(secretsEncryptionKey);
  const projectService = createProjectService(db);
  const authService = createAuthService(db);
  const secretService = createSecretService(db, secretsCrypto, projectService);
  const sseHub = createSseHub();

  return {
    services: {
      authService,
      db,
      projectService,
      secretService,
      secretsCrypto,
      sseHub,
    },
    async close() {
      sseHub.closeAll();
      await client.end();
    },
  };
};
