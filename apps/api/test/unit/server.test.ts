import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/server.js";
import { SESSION_COOKIE_NAME } from "../../src/services/session-tokens.js";
import { createStubServices } from "../helpers/test-services.js";

describe("server routes", () => {
  it("returns the expected payload", async () => {
    const server = await buildServer({
      corsOrigin: "http://localhost:3000",
      services: createStubServices(),
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/healthz",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("returns auto-advance status payloads that include skipHumanReview", async () => {
    const services = createStubServices();

    services.authService.authenticate = async () => ({
      sessionToken: "session-token",
      user: {
        id: "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9",
        email: "owner@example.com",
        displayName: "Owner",
        avatarUrl: null,
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
      },
    });
    services.autoAdvanceService.getStatus = async () => ({
      session: {
        id: "session-1",
        projectId: "91a28b19-825c-496f-bc99-205d02664a2e",
        status: "running",
        currentStep: "feature_product_create",
        pausedReason: null,
        autoApproveWhenClear: false,
        skipReviewSteps: false,
        skipHumanReview: true,
        autoRepairMilestoneCoverage: false,
        creativityMode: "balanced",
        retryCount: 0,
        reviewCount: 0,
        projectReviewCount: 0,
        milestoneRepairCount: 0,
        ciFixCount: 0,
        ciWaitWindowCount: 0,
        maxConcurrentJobs: 1,
        startedAt: "2026-04-02T00:00:00.000Z",
        pausedAt: null,
        completedAt: null,
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
      },
      nextStep: "feature_product_create",
    });

    const server = await buildServer({
      corsOrigin: "http://localhost:3000",
      services,
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/projects/91a28b19-825c-496f-bc99-205d02664a2e/auto-advance/status",
        cookies: {
          [SESSION_COOKIE_NAME]: "session-token",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        session: expect.objectContaining({
          skipHumanReview: true,
          status: "running",
        }),
        nextStep: "feature_product_create",
      });
    } finally {
      await server.close();
    }
  });
});
