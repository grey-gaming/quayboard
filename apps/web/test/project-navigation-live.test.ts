import { describe, expect, it } from "vitest";

import type { Job, Project } from "@quayboard/shared";

import { buildMissionControlTertiaryItems } from "../src/components/layout/project-navigation.js";

const project: Project = {
  id: "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9",
  name: "Quayboard",
  description: "Governed planning workspace.",
  ownerUserId: "owner-1",
  state: "COMPLETED",
  milestonePlanStatus: "finalized",
  milestonePlanFinalizedAt: "2026-04-08T00:00:00.000Z",
  onePagerApprovedAt: "2026-04-08T00:00:00.000Z",
  userFlowsApprovedAt: "2026-04-08T00:00:00.000Z",
  userFlowsApprovalSnapshot: null,
  milestoneMapGeneratedAt: "2026-04-08T00:00:00.000Z",
  milestoneMapReviewStatus: "approved",
  milestoneMapReviewIssues: [],
  milestoneMapReviewedAt: "2026-04-08T00:00:00.000Z",
  milestoneMapReviewLastJobId: null,
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z",
};

const createJob = (id: string, status: Job["status"], type = "GenerateProductSpec"): Job => ({
  id,
  projectId: project.id,
  type,
  status,
  inputs: {},
  outputs: null,
  error: null,
  queuedAt: "2026-04-08T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
});

describe("buildMissionControlTertiaryItems", () => {
  it("shows overview, live, pinned active jobs, and overflow", () => {
    const items = buildMissionControlTertiaryItems(project, [
      createJob("job-1", "running", "GenerateProductSpec"),
      createJob("job-2", "queued", "GenerateOnePager"),
      createJob("job-3", "running", "GenerateMilestoneFeatureSet"),
      createJob("job-4", "queued", "ReviewMilestoneMap"),
      createJob("job-5", "succeeded", "GenerateProductSpec"),
    ]);

    expect(items.map((item) => item.label)).toEqual([
      "Overview",
      "Live",
      "Generate Product Spec",
      "Generate One Pager",
      "Generate Milestone Feature Set",
      "More (1)",
    ]);
  });
});
