import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAppServices } from "../../src/app-services.js";
import { runMigrations } from "../../src/db/migrate.js";
import { buildServer } from "../../src/server.js";
import {
  ensureIntegrationDatabaseExists,
  integrationDatabaseUrl,
} from "./test-database.js";

const databaseUrl = integrationDatabaseUrl;
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
  let appServices: Awaited<ReturnType<typeof createAppServices>>;
  let server: Awaited<ReturnType<typeof buildServer>>;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.SECRETS_ENCRYPTION_KEY = secretsKey;
    await ensureIntegrationDatabaseExists();
    await runMigrations(databaseUrl);
    await runMigrations(databaseUrl);
    appServices = await createAppServices(databaseUrl, secretsKey);
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
      'TRUNCATE TABLE "encrypted_secrets", "llm_runs", "jobs", "use_cases", "questions", "product_specs", "one_pagers", "questionnaire_answers", "repos", "project_counters", "projects", "sessions", "settings", "users" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await server?.close();
    await appServices?.close();
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

  const registerAndSeedBlueprintProject = async ({
    approveUserFlows = true,
  }: { approveUserFlows?: boolean } = {}) => {
    const registerResponse = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        displayName: approveUserFlows ? "Blueprint Owner" : "Blueprint Gate Owner",
        email: approveUserFlows ? "blueprint-owner@example.com" : "blueprint-gate@example.com",
        password: "correct-horse-battery",
      },
    });

    expect(registerResponse.statusCode).toBe(200);
    const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");
    expect(cookie?.value).toBeTruthy();

    const ownerUserId = registerResponse.json().user.id as string;
    const projectResponse = await server.inject({
      method: "POST",
      url: "/api/projects",
      cookies: { qb_session: cookie!.value },
      payload: {
        name: approveUserFlows ? "Blueprint Project" : "Blueprint Gate Project",
      },
    });

    expect(projectResponse.statusCode).toBe(200);
    const projectId = projectResponse.json().id as string;

    await appServices.services.onePagerService.createVersion({
      approve: true,
      markdown: "# Overview\n\nApproved planning scope.",
      projectId,
      source: "ManualSave",
      title: "Overview",
    });
    await appServices.services.productSpecService.createVersion({
      markdown: "# Product Spec\n\nApproved scope.",
      projectId,
      source: "ManualSave",
      title: "Product Spec",
    });
    await appServices.services.productSpecService.approveCanonical(ownerUserId, projectId);
    await appServices.services.userFlowService.create(ownerUserId, projectId, {
      acceptanceCriteria: ["The flow can be completed."],
      coverageTags: ["happy-path", "onboarding"],
      doneCriteriaRefs: ["manual"],
      endState: "Journey complete",
      entryPoint: "Mission Control",
      flowSteps: ["Open page", "Complete action"],
      source: "manual",
      title: "Primary journey",
      userStory: "As a user, I want to complete the primary journey.",
    });

    if (approveUserFlows) {
      await appServices.services.userFlowService.approve(ownerUserId, projectId, {
        acceptedWarnings: [],
      });
    }

    return {
      cookieValue: cookie!.value,
      ownerUserId,
      projectId,
    };
  };

  it("runs migrations successfully more than once", async () => {
    await runMigrations(databaseUrl);
    await runMigrations(databaseUrl);
  });

  it("cancels running jobs that were interrupted by a server restart", async () => {
    const userId = "4fdf86ba-7f8b-4ef0-b3c7-77c77e7e5978";
    const projectId = "2f1c261d-c88e-44a3-a27e-fd1341ce72ca";
    const jobId = "9f5101dc-c45d-42eb-a34c-f9fcf3f52367";

    await sql`
      insert into "users" ("id", "email", "password_hash", "display_name")
      values (${userId}, ${"restart@example.com"}, ${"hashed-password"}, ${"Restart Tester"})
    `;
    await sql`
      insert into "projects" ("id", "owner_user_id", "name", "description", "state")
      values (${projectId}, ${userId}, ${"Restart Recovery"}, ${"Restart recovery test project"}, ${"READY"})
    `;
    await sql`
      insert into "jobs" (
        "id",
        "project_id",
        "created_by_user_id",
        "type",
        "status",
        "inputs",
        "queued_at",
        "started_at"
      )
      values (
        ${jobId},
        ${projectId},
        ${userId},
        ${"GenerateProjectOverview"},
        ${"running"},
        ${JSON.stringify({})}::jsonb,
        now() - interval '2 minutes',
        now() - interval '90 seconds'
      )
    `;

    const restartedServices = await createAppServices(databaseUrl, secretsKey);

    try {
      const recoveredJob = await restartedServices.services.jobService.getRawJob(jobId);

      expect(recoveredJob?.status).toBe("cancelled");
      expect(recoveredJob?.completedAt).toBeTruthy();
      expect(recoveredJob?.error).toEqual({
        code: "job_interrupted_by_server_restart",
        message: "The API restarted before this LLM job finished, so the job was cancelled.",
      });
    } finally {
      await restartedServices.close();
    }
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

      expect(questionnaireResponse.statusCode).toBe(409);

      const emptyOnePagerResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/one-pager`,
        cookies: { qb_session: cookie!.value },
      });

      expect(emptyOnePagerResponse.statusCode).toBe(409);
    } finally {
      restoreReadiness();
    }
  });

  it("reports missing secrets encryption via readiness without crashing startup", async () => {
    const degradedServices = await createAppServices(databaseUrl, null);
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

    const degradedServices = await createAppServices(databaseUrl, null);
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
    const degradedServices = await createAppServices(databaseUrl, null);
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

  it("requires explicit setup completion before overview surfaces unlock", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const originalValidatePat = appServices.services.githubService.validatePat;
    const originalVerifyRepository = appServices.services.githubService.verifyRepository;
    const originalCheckHealth = appServices.services.llmProviderService.checkHealth;
    const originalCheckAvailability = appServices.services.dockerService.checkAvailability;
    const originalVerifySandboxImage = appServices.services.dockerService.verifySandboxImage;

    appServices.services.githubService.validatePat = async () => ({
      repositories: [
        {
          owner: "acme",
          repo: "service-api",
          fullName: "acme/service-api",
          defaultBranch: "main",
          repoUrl: "https://github.com/acme/service-api",
        },
      ],
      viewerLogin: "setup-admin",
    });
    appServices.services.githubService.verifyRepository = async () => ({
      defaultBranch: "main",
      repoUrl: "https://github.com/acme/service-api",
    });
    appServices.services.llmProviderService.checkHealth = async () => ({
      ok: true,
      message: "Provider is reachable.",
      models: ["llama3.2", "mistral-nemo"],
    });
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
          displayName: "Setup User",
          email: "setup-flow@example.com",
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
          name: "Explicit Setup Project",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      const projectId = projectResponse.json().id as string;

      const earlyCompleteResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/complete-setup`,
        cookies: { qb_session: cookie!.value },
      });

      expect(earlyCompleteResponse.statusCode).toBe(409);

      const validatePatResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/github-pat/validate`,
        cookies: { qb_session: cookie!.value },
        payload: {
          pat: "ghp_setup",
        },
      });

      expect(validatePatResponse.statusCode).toBe(200);

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

      const configureLlmResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}`,
        cookies: { qb_session: cookie!.value },
        payload: {
          llmConfig: {
            provider: "ollama",
            model: "llama3.2",
          },
        },
      });

      expect(configureLlmResponse.statusCode).toBe(200);

      const verifyLlmResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/verify-llm`,
        cookies: { qb_session: cookie!.value },
      });

      expect(verifyLlmResponse.statusCode).toBe(200);

      const configureSandboxResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}`,
        cookies: { qb_session: cookie!.value },
        payload: {
          sandboxConfig: {
            allowlist: [],
            cpuLimit: 1,
            egressPolicy: "locked",
            memoryMb: 1024,
            timeoutSeconds: 300,
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

      const setupStatusResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/setup-status`,
        cookies: { qb_session: cookie!.value },
      });

      expect(setupStatusResponse.statusCode).toBe(200);
      expect(setupStatusResponse.json()).toEqual(
        expect.objectContaining({
          repoConnected: true,
          llmVerified: true,
          sandboxVerified: true,
        }),
      );

      const beforeCompletionProjectResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}`,
        cookies: { qb_session: cookie!.value },
      });

      expect(beforeCompletionProjectResponse.statusCode).toBe(200);
      expect(beforeCompletionProjectResponse.json().state).toBe("BOOTSTRAPPING");

      const blockedQuestionnaireResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/questionnaire-answers`,
        cookies: { qb_session: cookie!.value },
      });

      expect(blockedQuestionnaireResponse.statusCode).toBe(409);

      const completeSetupResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/complete-setup`,
        cookies: { qb_session: cookie!.value },
      });

      expect(completeSetupResponse.statusCode).toBe(200);
      expect(completeSetupResponse.json().state).toBe("READY_PARTIAL");

      const questionnaireResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/questionnaire-answers`,
        cookies: { qb_session: cookie!.value },
      });

      expect(questionnaireResponse.statusCode).toBe(200);
    } finally {
      appServices.services.githubService.validatePat = originalValidatePat;
      appServices.services.githubService.verifyRepository = originalVerifyRepository;
      appServices.services.llmProviderService.checkHealth = originalCheckHealth;
      appServices.services.dockerService.checkAvailability = originalCheckAvailability;
      appServices.services.dockerService.verifySandboxImage = originalVerifySandboxImage;
      restoreReadiness();
    }
  });

  it("creates a new unapproved canonical version when editing the overview document", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Overview Editor",
          email: "overview-editor@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");

      const meResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { qb_session: cookie!.value },
      });

      expect(meResponse.statusCode).toBe(200);
      const ownerUserId = meResponse.json().user.id as string;

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "Editable Overview Project",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      const projectId = projectResponse.json().id as string;

      await appServices.services.projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "READY_PARTIAL",
      });

      await appServices.services.onePagerService.createVersion({
        projectId,
        title: "Overview",
        markdown: "# Overview\n\nApproved planning scope.",
        source: "GenerateProjectOverview",
        approve: true,
      });

      const updateResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}/one-pager`,
        cookies: { qb_session: cookie!.value },
        payload: {
          markdown: "# Overview\n\nUpdated planning scope after manual editing.",
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toEqual(
        expect.objectContaining({
          version: 2,
          source: "ManualEdit",
          approvedAt: null,
          isCanonical: true,
        }),
      );

      const onePagerResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/one-pager`,
        cookies: { qb_session: cookie!.value },
      });

      expect(onePagerResponse.statusCode).toBe(200);
      expect(onePagerResponse.json().onePager).toEqual(
        expect.objectContaining({
          version: 2,
          markdown: "# Overview\n\nUpdated planning scope after manual editing.",
          approvedAt: null,
        }),
      );

      const versionsResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/one-pager/versions`,
        cookies: { qb_session: cookie!.value },
      });

      expect(versionsResponse.statusCode).toBe(200);
      expect(versionsResponse.json().versions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            version: 2,
            isCanonical: true,
            approvedAt: null,
            source: "ManualEdit",
          }),
          expect.objectContaining({
            version: 1,
            isCanonical: false,
          }),
        ]),
      );

      const projectStateResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}`,
        cookies: { qb_session: cookie!.value },
      });

      expect(projectStateResponse.statusCode).toBe(200);
      expect(projectStateResponse.json().state).toBe("READY_PARTIAL");
    } finally {
      restoreReadiness();
    }
  });

  it("gates Product Spec behind overview approval and clears Product Spec approval on manual edit", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Product Spec Editor",
          email: "product-spec-editor@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");

      const meResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { qb_session: cookie!.value },
      });

      expect(meResponse.statusCode).toBe(200);
      const ownerUserId = meResponse.json().user.id as string;

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "Editable Product Spec Project",
        },
      });

      expect(projectResponse.statusCode).toBe(200);
      const projectId = projectResponse.json().id as string;

      await appServices.services.projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "READY_PARTIAL",
      });

      const blockedProductSpecResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/product-spec`,
        cookies: { qb_session: cookie!.value },
      });

      expect(blockedProductSpecResponse.statusCode).toBe(409);
      expect(blockedProductSpecResponse.json()).toEqual({
        error: {
          code: "overview_approval_required",
          message: "Approve the overview document before using Product Spec.",
        },
      });

      await appServices.services.onePagerService.createVersion({
        projectId,
        title: "Overview",
        markdown: "# Overview\n\nApproved planning scope.",
        source: "GenerateProjectOverview",
        approve: true,
      });

      await appServices.services.productSpecService.createVersion({
        projectId,
        title: "Product Spec",
        markdown: "# Product Spec\n\nApproved specification.",
        source: "GenerateProductSpec",
      });
      await appServices.services.productSpecService.approveCanonical(ownerUserId, projectId);

      const updateResponse = await server.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}/product-spec`,
        cookies: { qb_session: cookie!.value },
        payload: {
          markdown: "# Product Spec\n\nUpdated specification after manual editing.",
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toEqual(
        expect.objectContaining({
          version: 2,
          source: "ManualEdit",
          approvedAt: null,
          isCanonical: true,
        }),
      );

      const productSpecResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/product-spec`,
        cookies: { qb_session: cookie!.value },
      });

      expect(productSpecResponse.statusCode).toBe(200);
      expect(productSpecResponse.json().productSpec).toEqual(
        expect.objectContaining({
          version: 2,
          markdown: "# Product Spec\n\nUpdated specification after manual editing.",
          approvedAt: null,
        }),
      );

      const versionsResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/product-spec/versions`,
        cookies: { qb_session: cookie!.value },
      });

      expect(versionsResponse.statusCode).toBe(200);
      expect(versionsResponse.json().versions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            version: 2,
            isCanonical: true,
            approvedAt: null,
            source: "ManualEdit",
          }),
          expect.objectContaining({
            version: 1,
            isCanonical: false,
          }),
        ]),
      );

      const blockedUserFlowsResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
      });

      expect(blockedUserFlowsResponse.statusCode).toBe(409);
      expect(blockedUserFlowsResponse.json()).toEqual({
        error: {
          code: "product_spec_approval_required",
          message: "Approve the Product Spec before using User Flows.",
        },
      });
    } finally {
      restoreReadiness();
    }
  });

  it("clears user-flow approval after create, update, and archive mutations", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const originalGetCanonical = appServices.services.productSpecService.getCanonical;
    const originalGetOnePager = appServices.services.onePagerService.getCanonical;
    const originalGetAnswers = appServices.services.questionnaireService.getAnswers;

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Flow Owner",
          email: "flows@example.com",
          password: "correct-horse-battery",
        },
      });

      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");
      expect(cookie?.value).toBeTruthy();

      const meResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { qb_session: cookie!.value },
      });
      const ownerUserId = meResponse.json().user.id as string;

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "Flow Ready Project",
        },
      });
      const projectId = projectResponse.json().id as string;

      await appServices.services.projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "READY_PARTIAL",
      });

      appServices.services.productSpecService.getCanonical = async () => ({
        id: "product-spec-approved",
        projectId,
        version: 1,
        title: "Product Spec",
        markdown: "# Product Spec",
        source: "ManualEdit",
        isCanonical: true,
        approvedAt: "2026-03-18T00:00:00.000Z",
        createdAt: "2026-03-18T00:00:00.000Z",
      });
      appServices.services.onePagerService.getCanonical = async () => ({
        id: "one-pager-approved",
        projectId,
        version: 1,
        title: "Overview",
        markdown: "# Overview",
        source: "GenerateProjectOverview",
        isCanonical: true,
        approvedAt: "2026-03-17T00:00:00.000Z",
        createdAt: "2026-03-17T00:00:00.000Z",
      });
      appServices.services.questionnaireService.getAnswers = async () => ({
        projectId,
        answers: {},
        updatedAt: "2026-03-16T00:00:00.000Z",
        completedAt: "2026-03-16T00:00:00.000Z",
      });

      const basePayload = {
        acceptanceCriteria: ["The flow can be completed."],
        coverageTags: ["happy-path", "onboarding"],
        doneCriteriaRefs: ["manual"],
        endState: "Journey complete",
        entryPoint: "Mission Control",
        flowSteps: ["Open page", "Complete action"],
        source: "manual",
        title: "Primary journey",
        userStory: "As a user, I want to complete the primary journey.",
      };

      const firstCreateResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
        payload: basePayload,
      });
      expect(firstCreateResponse.statusCode).toBe(200);
      const firstFlowId = firstCreateResponse.json().id as string;

      const firstApproveResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/user-flows/approve`,
        cookies: { qb_session: cookie!.value },
        payload: {
          acceptedWarnings: [],
        },
      });
      expect(firstApproveResponse.statusCode).toBe(200);
      expect(firstApproveResponse.json().approvedAt).toBeTruthy();

      const secondCreateResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
        payload: {
          ...basePayload,
          title: "Secondary journey",
        },
      });
      expect(secondCreateResponse.statusCode).toBe(200);

      const afterCreateResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
      });
      expect(afterCreateResponse.statusCode).toBe(200);
      expect(afterCreateResponse.json().approvedAt).toBeNull();
      expect(afterCreateResponse.json().coverage.acceptedWarnings).toEqual([]);

      await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/user-flows/approve`,
        cookies: { qb_session: cookie!.value },
        payload: {
          acceptedWarnings: [],
        },
      });

      const updateResponse = await server.inject({
        method: "PATCH",
        url: `/api/user-flows/${firstFlowId}`,
        cookies: { qb_session: cookie!.value },
        payload: {
          ...basePayload,
          title: "Primary journey updated",
        },
      });
      expect(updateResponse.statusCode).toBe(200);

      const afterUpdateResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
      });
      expect(afterUpdateResponse.statusCode).toBe(200);
      expect(afterUpdateResponse.json().approvedAt).toBeNull();
      expect(afterUpdateResponse.json().userFlows[0].title).toBe("Primary journey updated");

      await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/user-flows/approve`,
        cookies: { qb_session: cookie!.value },
        payload: {
          acceptedWarnings: [],
        },
      });

      const archiveResponse = await server.inject({
        method: "DELETE",
        url: `/api/user-flows/${firstFlowId}`,
        cookies: { qb_session: cookie!.value },
      });
      expect(archiveResponse.statusCode).toBe(204);

      const afterArchiveResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
      });
      expect(afterArchiveResponse.statusCode).toBe(200);
      expect(afterArchiveResponse.json().approvedAt).toBeNull();
      expect(afterArchiveResponse.json().userFlows).toHaveLength(1);

      const phaseGatesResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/phase-gates`,
        cookies: { qb_session: cookie!.value },
      });
      expect(phaseGatesResponse.statusCode).toBe(200);
      expect(phaseGatesResponse.json().phases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            phase: "User Flows",
            passed: false,
          }),
        ]),
      );

      const nextActionsResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/next-actions`,
        cookies: { qb_session: cookie!.value },
      });
      expect(nextActionsResponse.statusCode).toBe(200);
      expect(nextActionsResponse.json().actions).toEqual([
        expect.objectContaining({
          key: "user_flows",
          label: "Generate and approve user flows",
        }),
      ]);
    } finally {
      appServices.services.productSpecService.getCanonical = originalGetCanonical;
      appServices.services.onePagerService.getCanonical = originalGetOnePager;
      appServices.services.questionnaireService.getAnswers = originalGetAnswers;
      restoreReadiness();
    }
  });

  it("rejects user-flow approval when the project has no active flows", async () => {
    const restoreReadiness = withHealthyAuthReadiness();
    const originalGetCanonical = appServices.services.productSpecService.getCanonical;
    const originalGetOnePager = appServices.services.onePagerService.getCanonical;
    const originalGetAnswers = appServices.services.questionnaireService.getAnswers;

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "No Flows Owner",
          email: "no-flows@example.com",
          password: "correct-horse-battery",
        },
      });

      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");
      expect(cookie?.value).toBeTruthy();

      const meResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { qb_session: cookie!.value },
      });
      const ownerUserId = meResponse.json().user.id as string;

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "No Flows Project",
        },
      });
      const projectId = projectResponse.json().id as string;

      await appServices.services.projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "READY_PARTIAL",
      });

      appServices.services.productSpecService.getCanonical = async () => ({
        id: "product-spec-approved",
        projectId,
        version: 1,
        title: "Product Spec",
        markdown: "# Product Spec",
        source: "ManualEdit",
        isCanonical: true,
        approvedAt: "2026-03-18T00:00:00.000Z",
        createdAt: "2026-03-18T00:00:00.000Z",
      });
      appServices.services.onePagerService.getCanonical = async () => ({
        id: "one-pager-approved",
        projectId,
        version: 1,
        title: "Overview",
        markdown: "# Overview",
        source: "GenerateProjectOverview",
        isCanonical: true,
        approvedAt: "2026-03-17T00:00:00.000Z",
        createdAt: "2026-03-17T00:00:00.000Z",
      });
      appServices.services.questionnaireService.getAnswers = async () => ({
        projectId,
        answers: {},
        updatedAt: "2026-03-16T00:00:00.000Z",
        completedAt: "2026-03-16T00:00:00.000Z",
      });

      const approveResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${projectId}/user-flows/approve`,
        cookies: { qb_session: cookie!.value },
        payload: {
          acceptedWarnings: ["Add at least one active user flow."],
        },
      });

      expect(approveResponse.statusCode).toBe(409);
      expect(approveResponse.json()).toEqual({
        error: {
          code: "user_flows_required",
          message: "Add at least one active user flow before approval.",
        },
      });

      const listResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${projectId}/user-flows`,
        cookies: { qb_session: cookie!.value },
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().approvedAt).toBeNull();
    } finally {
      appServices.services.productSpecService.getCanonical = originalGetCanonical;
      appServices.services.onePagerService.getCanonical = originalGetOnePager;
      appServices.services.questionnaireService.getAnswers = originalGetAnswers;
      restoreReadiness();
    }
  });

  it("applies setup and Product Spec gates to user-flow update and archive routes", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const registerResponse = await server.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Gate Owner",
          email: "gates@example.com",
          password: "correct-horse-battery",
        },
      });

      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");
      expect(cookie?.value).toBeTruthy();

      const meResponse = await server.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { qb_session: cookie!.value },
      });
      const ownerUserId = meResponse.json().user.id as string;

      const projectResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
        payload: {
          name: "Flow Gate Project",
        },
      });
      const projectId = projectResponse.json().id as string;

      const flow = await appServices.services.userFlowService.create(ownerUserId, projectId, {
        acceptanceCriteria: ["The flow can be completed."],
        coverageTags: ["happy-path"],
        doneCriteriaRefs: ["manual"],
        endState: "Journey complete",
        entryPoint: "Mission Control",
        flowSteps: ["Open page", "Complete action"],
        source: "manual",
        title: "Primary journey",
        userStory: "As a user, I want to complete the primary journey.",
      });

      const blockedBySetupResponse = await server.inject({
        method: "PATCH",
        url: `/api/user-flows/${flow.id}`,
        cookies: { qb_session: cookie!.value },
        payload: {
          acceptanceCriteria: ["The flow can be completed."],
          coverageTags: ["happy-path"],
          doneCriteriaRefs: ["manual"],
          endState: "Journey complete",
          entryPoint: "Mission Control",
          flowSteps: ["Open page", "Complete action"],
          source: "manual",
          title: "Primary journey updated",
          userStory: "As a user, I want to complete the primary journey.",
        },
      });
      expect(blockedBySetupResponse.statusCode).toBe(409);
      expect(blockedBySetupResponse.json()).toEqual({
        error: {
          code: "setup_incomplete",
          message: "Complete project setup before accessing overview and user-flow planning.",
        },
      });

      await appServices.services.projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "READY_PARTIAL",
      });

      const blockedByProductSpecResponse = await server.inject({
        method: "DELETE",
        url: `/api/user-flows/${flow.id}`,
        cookies: { qb_session: cookie!.value },
      });
      expect(blockedByProductSpecResponse.statusCode).toBe(409);
      expect(blockedByProductSpecResponse.json()).toEqual({
        error: {
          code: "product_spec_approval_required",
          message: "Approve the Product Spec before using User Flows.",
        },
      });
    } finally {
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

  it("gates blueprint routes on user-flow approval and a complete decision deck", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const blockedProject = await registerAndSeedBlueprintProject({ approveUserFlows: false });
      const blockedDeckResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${blockedProject.projectId}/blueprints/generate-deck`,
        cookies: { qb_session: blockedProject.cookieValue },
      });

      expect(blockedDeckResponse.statusCode).toBe(409);
      expect(blockedDeckResponse.json()).toEqual({
        error: {
          code: "user_flows_approval_required",
          message: "Approve user flows before using Blueprint Builder.",
        },
      });

      const readyProject = await registerAndSeedBlueprintProject();
      const missingDeckResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${readyProject.projectId}/blueprints/generate`,
        cookies: { qb_session: readyProject.cookieValue },
        payload: {
          kind: "ux",
        },
      });

      expect(missingDeckResponse.statusCode).toBe(409);
      expect(missingDeckResponse.json()).toEqual({
        error: {
          code: "decision_deck_required",
          message: "Generate the decision deck before creating blueprints.",
        },
      });

      await appServices.services.blueprintService.replaceDecisionDeck({
        cards: [
          {
            key: "architecture-style",
            category: "tech",
            title: "Architecture style",
            prompt: "Choose the primary service boundary model.",
            recommendation: {
              id: "modular-monolith",
              label: "Modular monolith",
              description: "Keep early delivery cohesive.",
            },
            alternatives: [
              {
                id: "service-oriented",
                label: "Service oriented",
                description: "Split early into multiple services.",
              },
            ],
          },
        ],
        projectId: readyProject.projectId,
      });

      const incompleteDeckResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${readyProject.projectId}/blueprints/generate`,
        cookies: { qb_session: readyProject.cookieValue },
        payload: {
          kind: "ux",
        },
      });

      expect(incompleteDeckResponse.statusCode).toBe(409);
      expect(incompleteDeckResponse.json()).toEqual({
        error: {
          code: "decision_selection_required",
          message: "Select an option for every decision card before generating blueprints.",
        },
      });
    } finally {
      restoreReadiness();
    }
  });

  it("requires completed review and cleared blockers before blueprint approval", async () => {
    const restoreReadiness = withHealthyAuthReadiness();

    try {
      const project = await registerAndSeedBlueprintProject();
      const [card] = await appServices.services.blueprintService.replaceDecisionDeck({
        cards: [
          {
            key: "architecture-style",
            category: "tech",
            title: "Architecture style",
            prompt: "Choose the primary service boundary model.",
            recommendation: {
              id: "modular-monolith",
              label: "Modular monolith",
              description: "Keep early delivery cohesive.",
            },
            alternatives: [
              {
                id: "service-oriented",
                label: "Service oriented",
                description: "Split early into multiple services.",
              },
            ],
          },
        ],
        projectId: project.projectId,
      });

      await appServices.services.blueprintService.updateDecisionCards(
        project.ownerUserId,
        project.projectId,
        {
          cards: [{ id: card.id, selectedOptionId: "modular-monolith" }],
        },
      );

      const blueprint = await appServices.services.blueprintService.createBlueprintVersion({
        kind: "ux",
        markdown: "# UX Blueprint\n\nCanonical blueprint.",
        projectId: project.projectId,
        source: "ManualSave",
        title: "UX Blueprint",
      });

      const missingReviewResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${project.projectId}/artifacts/blueprint_ux/${blueprint.id}/approve`,
        cookies: { qb_session: project.cookieValue },
      });

      expect(missingReviewResponse.statusCode).toBe(409);
      expect(missingReviewResponse.json()).toEqual({
        error: {
          code: "artifact_review_required",
          message: "Run and complete artifact review before approval.",
        },
      });

      const reviewJob = await appServices.services.jobService.createJob({
        createdByUserId: project.ownerUserId,
        projectId: project.projectId,
        type: "ReviewBlueprintUX",
        inputs: {
          artifactId: blueprint.id,
          artifactType: "blueprint_ux",
        },
      });
      const run = await appServices.services.artifactReviewService.createRun(
        project.ownerUserId,
        project.projectId,
        "blueprint_ux",
        blueprint.id,
        reviewJob.id,
      );

      await appServices.services.artifactReviewService.replaceRunItems(run.id, [
        {
          artifactId: blueprint.id,
          artifactType: "blueprint_ux",
          category: "navigation",
          details: "The primary path is missing a blocker review.",
          projectId: project.projectId,
          severity: "BLOCKER",
          title: "Resolve blocker before approval",
        },
      ]);
      await appServices.services.artifactReviewService.markRunSucceeded(run.id);

      const blockedApprovalResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${project.projectId}/artifacts/blueprint_ux/${blueprint.id}/approve`,
        cookies: { qb_session: project.cookieValue },
      });

      expect(blockedApprovalResponse.statusCode).toBe(409);
      expect(blockedApprovalResponse.json()).toEqual({
        error: {
          code: "artifact_blockers_open",
          message: "Resolve or accept all blocker review items before approval.",
        },
      });

      const reviewItems = await appServices.services.artifactReviewService.listItems(
        project.ownerUserId,
        project.projectId,
        "blueprint_ux",
        blueprint.id,
      );

      await appServices.services.artifactReviewService.updateReviewItem(
        project.ownerUserId,
        reviewItems.items[0]!.id,
        "ACCEPTED",
      );

      const approvalResponse = await server.inject({
        method: "POST",
        url: `/api/projects/${project.projectId}/artifacts/blueprint_ux/${blueprint.id}/approve`,
        cookies: { qb_session: project.cookieValue },
      });

      expect(approvalResponse.statusCode).toBe(200);
      expect(approvalResponse.json()).toEqual(
        expect.objectContaining({
          artifactId: blueprint.id,
          artifactType: "blueprint_ux",
          approvedByUserId: project.ownerUserId,
          projectId: project.projectId,
        }),
      );
    } finally {
      restoreReadiness();
    }
  });
});
