import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAppServices } from "../../src/app-services.js";
import { readDatabaseUrl } from "../../src/config.js";
import { runMigrations } from "../../src/db/migrate.js";
import { buildServer } from "../../src/server.js";

const databaseUrl = readDatabaseUrl();
const secretsKey = Buffer.alloc(32, 3).toString("base64url");

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

  it("runs migrations successfully more than once", async () => {
    await runMigrations();
    await runMigrations();
  });

  it("registers, authenticates, and logs out a user with a cookie session", async () => {
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
  });

  it("supports the M2 scratch-path foundations", async () => {
    const unauthorizedResponse = await server.inject({
      method: "GET",
      url: "/api/events",
    });

    expect(unauthorizedResponse.statusCode).toBe(401);

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
  });

  it("reports missing secrets encryption via readiness without crashing startup", async () => {
    const degradedServices = createAppServices(databaseUrl, null);
    const degradedServer = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: degradedServices.services,
    });

    try {
      const registerResponse = await degradedServer.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Readiness User",
          email: "readiness@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");

      const readinessResponse = await degradedServer.inject({
        method: "GET",
        url: "/api/system/readiness",
        cookies: { qb_session: cookie!.value },
      });

      expect(readinessResponse.statusCode).toBe(200);
      expect(readinessResponse.json().checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "encryption_key",
            status: "fail",
            message: "Set SECRETS_ENCRYPTION_KEY before continuing.",
          }),
        ]),
      );
    } finally {
      await degradedServer.close();
      await degradedServices.close();
    }
  });

  it("fails secret-backed routes explicitly when the encryption key is missing", async () => {
    const degradedServices = createAppServices(databaseUrl, null);
    const degradedServer = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: degradedServices.services,
    });

    try {
      const registerResponse = await degradedServer.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          displayName: "Secrets User",
          email: "secrets@example.com",
          password: "correct-horse-battery",
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      const cookie = registerResponse.cookies.find(({ name }) => name === "qb_session");

      const projectResponse = await degradedServer.inject({
        method: "POST",
        url: "/api/projects",
        cookies: { qb_session: cookie!.value },
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
        cookies: { qb_session: cookie!.value },
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

  it("rejects whitespace-only display names and project names before persistence", async () => {
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
  });
});
