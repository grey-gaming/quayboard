import { describe, expect, it, vi } from "vitest";

import { createFeatureWorkstreamService } from "../../src/services/feature-workstream-service.js";
import { HttpError } from "../../src/services/http-error.js";

const FEATURE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

describe("feature workstream service", () => {
  it("rejects new revisions for completed milestones", async () => {
    const milestoneService = {
      assertActiveMilestone: vi
        .fn()
        .mockRejectedValue(
          new HttpError(
            409,
            "active_milestone_required",
            "Only the active milestone can be changed at this stage.",
          ),
        ),
    };
    const service = createFeatureWorkstreamService({} as never, milestoneService as never);
    vi.spyOn(service, "getFeatureContext").mockResolvedValue({
      feature: {
        id: FEATURE_ID,
        projectId: PROJECT_ID,
        milestoneId: MILESTONE_ID,
      } as never,
      headFeatureRevision: {
        title: "Feature Title",
      } as never,
    });

    await expect(
      service.createRevision(USER_ID, FEATURE_ID, "ux", {
        markdown: "# Revision",
        source: "manual",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "active_milestone_required",
    });

    expect(milestoneService.assertActiveMilestone).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      MILESTONE_ID,
    );
  });
});
