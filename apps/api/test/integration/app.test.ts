import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAppServices } from "../../src/app-services.js";
import { readDatabaseUrl } from "../../src/config.js";
import { runMigrations } from "../../src/db/migrate.js";
import { buildServer } from "../../src/server.js";

const databaseUrl = readDatabaseUrl();
const secretsKey = Buffer.alloc(32, 3).toString("base64url");
const readyChecks = [
  {
    key: "database",
    label: "Database",
    status: "pass",
    message: "Database connection succeeded.",
  },
  {
    key: "encryption_key",
    label: "Encryption Key",
    status: "pass",
    message: "Secrets encryption key is configured.",
  },
  {
    key: "docker",
    label: "Docker",
    status: "pass",
    message: "Docker is reachable.",
  },
  {
    key: "artifact_storage",
    label: "Artifact Storage",
    status: "pass",
    message: "Artifact storage path is writable.",
  },
  {
    key: "providers",
    label: "Provider Adapters",
    status: "pass",
    message: "Enabled providers: ollama, openai.",
  },
] as const;

describe("API integration", () => {
  const sql = postgres(databaseUrl, { max: 1 });
  const appServices = createAppServices(databaseUrl, secretsKey);
  let server: Awaited<ReturnType<typeof buildServer>>;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.SECRETS_ENCRYPTION_KEY = secretsKey;
    await runMigrations();
    await runMigrations();
    server = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: appServices.services,
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await sql.unsafe(
      'TRUNCATE TABLE "encrypted_secrets", "llm_runs", "jobs", "use_cases", "questions", "one_pagers", "questionnaire_answers", "repos", "project_counters", "projects", "sessions", "settings", "users" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await server?.close();
    await appServices.close();
    await sql.end();
  });

  const withHealthyAuthReadiness = () => {
    const originalGetReadiness = appServices.services.systemReadinessService.getReadiness;
    appServices.services.systemReadinessService.getReadiness = async () => ({
      checks: readyChecks.map((check) => ({ ...check })),
    });

    return () => {
      appServices.services.systemReadinessService.getReadiness = originalGetReadiness;
    };
  };

  it("runs migrations successfully more than once", async () => {
    await runMigrations();
    await runMigrations();
  });

  it("registers, authenticates, and logs out a user with a cookie session", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Casey Dev",
          email: "casey@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");
      expect(cookie?.value).toBeTruthy();

      const meResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: {
          qb_session: cookie!.value,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      expect(meResponse.json().user.email).toBe("casey@example.com");

      const logoutResponse = await server.inject({
        method: "POST",
        url: "/auth/logout",
        cookies: {
          qb_session: cookie!.value,
        },
      });

      expect(logoutResponse.statusCode).toBe(204);

      const afterLogoutResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: {
          qb_session: cookie!.value,
        },
      });

      expect(afterLogoutResponse.statusCode).toBe(401);
    } finally {
      restoreReadiness();
    }
  });

  it("serves instance readiness without authentication", async () => {
    const readinessResponse = await server.inject({
      method: "GET",
      url: "/api/system/readiness",
    });

    expect(readinessResponse.statusCode).toBe(200);
    expect(readinessResponse.json().checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "database",
          status: "pass",
        }),
      ]),
    );
  });

  it("supports the M2 scratch-path foundations", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const unauthorizedResponse = await server.inject({
      method: "GET",
      url: "/api/events",
    });

    expect(unauthorizedResponse.statusCode).toBe(401);
    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Pat Operator",
          email: "pat@example.com",
          password: "correct-horse-battery",
        },
      });

      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");
      expect(cookie?.value).toBeTruthy();

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "Harbor Control",
          description: "Internal test project",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      expect(projectResponse.json().state).toBe("EMPTY");
      const projectId = projectResponse.json().id as string;

      const secretResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/secrets`,
        cookies: { qb_session: cookie!.value },
        payload: {
          type: "github_pat",
          value: "ghp_1234567890abcdef",
        },
      });

      expect(secretResponse.statusCode).toBe(200);
      expect(secretResponse.json().maskedIdentifier).not.toContain("ghp_1234567890abcdef");

      const shortSecretResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/secrets`,
        cookies: { qb_session: cookie!.value },
        payload: {
          type: "llm_api_key",
          value: "abc",
        },
      });

      expect(shortSecretResponse.statusCode).toBe(200);
      expect(shortSecretResponse.json().maskedIdentifier).not.toContain("abc");

      const secretListResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/secrets`,
        cookies: { qb_session: cookie!.value },
      });

      expect(secretListResponse.statusCode).toBe(200);
      expect(secretListResponse.json().secrets).toHaveLength(2);
      expect(JSON.stringify(secretListResponse.json())).not.toContain("ghp_1234567890abcdef");
      expect(JSON.stringify(secretListResponse.json())).not.toContain('"abc"');

      const firstSecretId = secretListResponse.json().secrets[0].id as string;
      const invalidSecretUpdateResponse = await server.inject({
        method: "PATCH",
        url: `/api/secrets/${firstSecretId}`,
        cookies: { qb_session: cookie!.value },
        payload: {},
      });

      expect(invalidSecretUpdateResponse.statusCode).toBe(400);

      const controller = new AbortController();
      const eventStreamResponse = await fetch(`${baseUrl}/api/events`, {
        headers: {
          Cookie: `qb_session=${cookie!.value}`,
        },
        signal: controller.signal,
      });

      expect(eventStreamResponse.status).toBe(200);
      expect(eventStreamResponse.headers.get("content-type")).toContain(
        "text/event-stream",
      );

      const reader = eventStreamResponse.body?.getReader();
      const chunk = await reader?.read();
      controller.abort();

      expect(Buffer.from(chunk?.value ?? []).toString("utf8")).toContain(
        "event: connected",
      );

      const questionnaireResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}/questionnaire-answers`,
        cookies: { qb_session: cookie!.value },
        payload: {
          answers: {
            q1_name_and_description: "A planning control plane for software projects.",
            q2_who_is_it_for: "Engineering leads and delivery managers.",
          },
        },
      });

      expect(questionnaireResponse.statusCode).toBe(200);
      expect(questionnaireResponse.json().answers.q1_name_and_description).toContain(
        "planning control plane",
      );

      const emptyOnePagerResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/one-pager`,
        cookies: { qb_session: cookie!.value },
      });

      expect(emptyOnePagerResponse.statusCode).toBe(200);
      expect(emptyOnePagerResponse.json()).toEqual({ onePager: null });
    } finally {
      restoreReadiness();
    }
  });

  it("reports missing secrets encryption via readiness without crashing startup", async () => {
    const degradedServices = createAppServices(databaseUrl, null);
    const degradedServer = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: degradedServices.services,
    });

    try {
      const readinessResponse = await degradedServer.inject({
        method: "GET",
        url: "/api/system/readiness",
      });

      expect(readinessResponse.statusCode).toBe(200);
      expect(readinessResponse.json().checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "encryption_key",
            status: "fail",
            message:
              "SECRETS_ENCRYPTION_KEY is missing. Add it to .env, restart the API, then reload this page.",
          }),
        ]),
      );
    } finally {
      await degradedServer.close();
      await degradedServices.close();
    }
  });

  it("blocks register and login when instance readiness is not fully green", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const seedRegisterResponse = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        displayName: "Blocked Auth User",
        email: "blocked-auth@example.com",
        password: "correct-horse-battery",
      },
    });
    restoreReadiness();

    expect(seedRegisterResponse.statusCode).toBe(200);

    const degradedServices = createAppServices(databaseUrl, null);
    const degradedServer = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: degradedServices.services,
    });

    try {
      const blockedRegisterResponse = await degradedServer.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Readiness User",
          email: "readiness@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(blockedRegisterResponse.statusCode).toBe(503);
      expect(blockedRegisterResponse.cookies).toHaveLength(0);
      expect(blockedRegisterResponse.json()).toEqual({
        error: {
          code: "instance_not_ready",
          message: "Resolve all instance readiness checks before registering or signing in.",
        },
      });

      const blockedLoginResponse = await degradedServer.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "blocked-auth@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(blockedLoginResponse.statusCode).toBe(503);
      expect(blockedLoginResponse.cookies).toHaveLength(0);
      expect(blockedLoginResponse.json()).toEqual({
        error: {
          code: "instance_not_ready",
          message: "Resolve all instance readiness checks before registering or signing in.",
        },
      });
    } finally {
      await degradedServer.close();
      await degradedServices.close();
    }
  });

  it("fails secret-backed routes explicitly when the encryption key is missing", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const seedRegisterResponse = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        displayName: "Secrets User",
        email: "secrets@example.com",
        password: "correct-horse-battery",
      },
    });
    restoreReadiness();

    expect(seedRegisterResponse.statusCode).toBe(200);
    const userId = seedRegisterResponse.json().user.id as string;
    const degradedServices = createAppServices(databaseUrl, null);
    const degradedServer = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: degradedServices.services,
    });

    try {
      const session = await degradedServices.services.authService.createSession(userId);

      const projectResponse = await degradedServer.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: session.cookieValue },
        payload: {
          name: "No Key Project",
          description: "Verifies degraded secret handling",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      const projectId = projectResponse.json().id as string;

      const secretResponse = await degradedServer.inject({
        method: "POST",
        url: `/api/projects/${projectId}/secrets`,
        cookies: { qb_session: session.cookieValue },
        payload: {
          type: "github_pat",
          value: "ghp_1234567890abcdef",
        },
      });

      expect(secretResponse.statusCode).toBe(503);
      expect(secretResponse.json()).toEqual({
        error: {
          code: "secrets_encryption_unavailable",
          message:
            "Secrets encryption is unavailable. Set SECRETS_ENCRYPTION_KEY and restart the API.",
        },
      });
    } finally {
      await degradedServer.close();
      await degradedServices.close();
    }
  });

  it("validates a GitHub PAT, returns setup state, and clears repo verification after PAT rotation", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const originalValidatePat = appServices.services.githubService.validatePat;
    const originalVerifyRepository = appServices.services.githubService.verifyRepository;
    const originalCheckHealth = appServices.services.llmProviderService.checkHealth;

    appServices.services.githubService.validatePat = async ({ token }) => ({
      viewerLogin: token === "ghp_rotated" ? "rotated-admin" : "pat-admin",
      repositories: [
        {
          owner: "acme",
          repo: "service-api",
          fullName: "acme/service-api",
          defaultBranch: "main",
          repoUrl: "https://github.com/acme/service-api",
        },
      ],
    });
    appServices.services.githubService.verifyRepository = async () => ({
      defaultBranch: "main",
      repoUrl: "https://github.com/acme/service-api",
    });
    appServices.services.llmProviderService.checkHealth = async ({ baseUrl }) => ({
      ok: true,
      message: "Available.",
      models:
        baseUrl === process.env.OLLAMA_HOST || baseUrl === "http://127.0.0.1:11434"
          ? ["llama3.2", "mistral-nemo"]
          : [],
    });

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Setup User",
          email: "setup@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "PAT Rotation Project",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      const projectId = projectResponse.json().id as string;

      const validatePatResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/github-pat/validate`,
        cookies: { qb_session: cookie!.value },
        payload: {
          pat: "ghp_initial",
        },
      });

      expect(validatePatResponse.statusCode).toBe(200);
      expect(validatePatResponse.json().repo.patConfigured).toBe(true);
      expect(validatePatResponse.json().repo.viewerLogin).toBe("pat-admin");
      expect(validatePatResponse.json().repo.availableRepos).toEqual([
        expect.objectContaining({
          fullName: "acme/service-api",
        }),
      ]);

      const loadModelsResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/llm-models`,
        cookies: { qb_session: cookie!.value },
        payload: {
          provider: "ollama",
        },
      });

      expect(loadModelsResponse.statusCode).toBe(200);
      expect(loadModelsResponse.json()).toEqual({
        models: ["llama3.2", "mistral-nemo"],
      });

      const configureRepoResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}`,
        cookies: { qb_session: cookie!.value },
        payload: {
          repoConfig: {
            owner: "acme",
            provider: "github",
            repo: "service-api",
          },
        },
      });

      expect(configureRepoResponse.statusCode).toBe(200);

      const setupStatusResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/setup-status`,
        cookies: { qb_session: cookie!.value },
      });

      expect(setupStatusResponse.statusCode).toBe(200);
      expect(setupStatusResponse.json().repoConnected).toBe(true);

      const rotatePatResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/github-pat/validate`,
        cookies: { qb_session: cookie!.value },
        payload: {
          pat: "ghp_rotated",
        },
      });

      expect(rotatePatResponse.statusCode).toBe(200);
      expect(rotatePatResponse.json().repo.viewerLogin).toBe("rotated-admin");

      const afterRotationStatusResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/setup-status`,
        cookies: { qb_session: cookie!.value },
      });

      expect(afterRotationStatusResponse.statusCode).toBe(200);
      expect(afterRotationStatusResponse.json().repoConnected).toBe(false);
    } finally {
      appServices.services.githubService.validatePat = originalValidatePat;
      appServices.services.githubService.verifyRepository = originalVerifyRepository;
      appServices.services.llmProviderService.checkHealth = originalCheckHealth;
      restoreReadiness();
    }
  });

  it("returns setup state after sandbox verification without leaking internal metadata", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const originalCheckAvailability = appServices.services.dockerService.checkAvailability;
    const originalVerifySandboxImage = appServices.services.dockerService.verifySandboxImage;

    appServices.services.dockerService.checkAvailability = async () => ({
      ok: true,
      message: "Docker daemon is reachable.",
    });
    appServices.services.dockerService.verifySandboxImage = async () => ({
      ok: true,
      message: "Sandbox container startup succeeded.",
    });

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Sandbox User",
          email: "sandbox@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "Sandbox Project",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      const projectId = projectResponse.json().id as string;

      const configureSandboxResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}`,
        cookies: { qb_session: cookie!.value },
        payload: {
          sandboxConfig: {
            allowlist: ["api.example.com"],
            cpuLimit: 2,
            egressPolicy: "allowlisted",
            memoryMb: 2048,
            timeoutSeconds: 600,
          },
        },
      });

      expect(configureSandboxResponse.statusCode).toBe(200);

      const verifySandboxResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/verify-sandbox`,
        cookies: { qb_session: cookie!.value },
      });

      expect(verifySandboxResponse.statusCode).toBe(200);
      expect(verifySandboxResponse.json().sandboxVerified).toBe(true);

      const setupResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/setup`,
        cookies: { qb_session: cookie!.value },
      });

      expect(setupResponse.statusCode).toBe(200);
      expect(setupResponse.json().sandboxConfig).toEqual({
        allowlist: ["api.example.com"],
        cpuLimit: 2,
        egressPolicy: "allowlisted",
        memoryMb: 2048,
        timeoutSeconds: 600,
      });
    } finally {
      appServices.services.dockerService.checkAvailability = originalCheckAvailability;
      appServices.services.dockerService.verifySandboxImage = originalVerifySandboxImage;
      restoreReadiness();
    }
  });

  it("rejects whitespace-only display names and project names before persistence", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const invalidRegisterResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "   ",
          email: "trim-test@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(invalidRegisterResponse.statusCode).toBe(400);

      const validRegisterResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Valid User",
          email: "trim-test@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(validRegisterResponse.statusCode).toBe(200);
      const cookie = validRegisterResponse.cookies.find(({ name }) => name === "qb_session");

      const invalidProjectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "   ",
        },
      });

      expect(invalidProjectResponse.statusCode).toBe(400);

      const listProjectsResponse = await server.inject({
        method: "GET",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
      });

      expect(listProjectsResponse.statusCode).toBe(200);
      expect(listProjectsResponse.json().projects).toHaveLength(0);
    } finally {
      restoreReadiness();
    }
  });
});
