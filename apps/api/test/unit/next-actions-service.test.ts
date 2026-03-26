import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextActionsService } from "../../src/services/next-actions-service.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

// Helpers for building minimal milestone/feature objects

const makeMilestone = (overrides: {
  id?: string;
  isActive?: boolean;
  status?: "draft" | "approved" | "completed";
  featureCount?: number;
  position?: number;
  title?: string;
}) => ({
  id: overrides.id ?? "milestone-1",
  projectId: PROJECT_ID,
  position: overrides.position ?? 1,
  title: overrides.title ?? "Milestone 1",
  summary: "A milestone",
  status: overrides.status ?? "approved",
  linkedUserFlows: [],
  featureCount: overrides.featureCount ?? 0,
  isActive: overrides.isActive ?? true,
  approvedAt: overrides.status === "draft" ? null : "2026-01-01T00:00:00.000Z",
  completedAt: overrides.status === "completed" ? "2026-01-02T00:00:00.000Z" : null,
  reconciliationStatus: "not_started" as const,
  reconciliationIssues: [],
  reconciliationReviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const makeFeature = (id: string, milestoneId: string) => ({
  id,
  milestoneId,
  projectId: PROJECT_ID,
  featureKey: `F-${id.slice(0, 4)}`,
  milestoneTitle: "Milestone 1",
  kind: "screen" as const,
  priority: "must_have" as const,
  status: "draft" as const,
  headRevision: { id: `rev-${id}`, version: 1, title: "Feature", summary: "", acceptanceCriteria: [], source: "generated" },
  documents: {
    product: { required: true, state: "missing" as const },
    ux: { required: false, state: "missing" as const },
    tech: { required: false, state: "missing" as const },
    userDocs: { required: false, state: "missing" as const },
    archDocs: { required: false, state: "missing" as const },
  },
  dependencyIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
});

// Creates the shared mock services needed to reach the milestone/feature section of nextActionsService.
// All upstream gates (setup, questionnaire, specs, user flows) are configured to pass.
const makeServices = (overrides: {
  milestones?: ReturnType<typeof makeMilestone>[];
  features?: ReturnType<typeof makeFeature>[];
  designDoc?: object | null;
}) => {
  const card = { id: "card-1", selectedOptionId: "opt-1", customSelection: null, acceptedAt: "2026-01-01T00:00:00.000Z", recommendation: { id: "opt-1" } };
  const blueprint = { id: "bp-1", markdown: "# UX Spec" };

  const milestones = overrides.milestones ?? [];
  const features = overrides.features ?? [];
  const designDoc = "designDoc" in overrides ? overrides.designDoc : null;

  return {
    artifactApprovalService: {
      getState: vi.fn().mockResolvedValue({ approval: { id: "approval-1" } }),
      getApproval: vi.fn().mockResolvedValue({ id: "approval-1" }),
    },
    blueprintService: {
      listDecisionCards: vi.fn().mockResolvedValue({ cards: [card] }),
      getCanonical: vi.fn().mockResolvedValue({ uxBlueprint: blueprint, techBlueprint: blueprint }),
      getCanonicalByKind: vi.fn().mockResolvedValue(blueprint),
    },
    featureService: {
      list: vi.fn().mockResolvedValue({ features }),
    },
    featureWorkstreamService: {
      getTracks: vi.fn().mockResolvedValue({
        tracks: {
          product: { required: true, headRevision: { id: "rev-1" }, status: "approved" },
          ux: { required: false, headRevision: null, status: "missing" },
          tech: { required: false, headRevision: null, status: "missing" },
          userDocs: { required: false, headRevision: null, status: "missing" },
          archDocs: { required: false, headRevision: null, status: "missing" },
        },
      }),
    },
    milestoneService: {
      list: vi.fn().mockResolvedValue({ milestones }),
      getCanonicalDesignDoc: vi.fn().mockResolvedValue(designDoc),
    },
    projectSetupService: {
      getSetupStatus: vi.fn().mockResolvedValue({ repoConnected: true, llmVerified: true, sandboxVerified: true }),
      isSetupCompleted: vi.fn().mockResolvedValue(true),
    },
    questionnaireService: {
      getAnswers: vi.fn().mockResolvedValue({ completedAt: "2026-01-01T00:00:00.000Z" }),
    },
    onePagerService: {
      getCanonical: vi.fn().mockResolvedValue({ id: "op-1", approvedAt: "2026-01-01T00:00:00.000Z", markdown: "# Overview" }),
    },
    productSpecService: {
      getCanonical: vi.fn().mockResolvedValue({ id: "ps-1", approvedAt: "2026-01-01T00:00:00.000Z", markdown: "# Product Spec" }),
    },
    userFlowService: {
      list: vi.fn().mockResolvedValue({
        userFlows: [{ id: "uf-1", title: "Onboarding", userStory: "As a user..." }],
        approvedAt: "2026-01-01T00:00:00.000Z",
        coverage: { warnings: [] },
      }),
    },
  };
};

const makeService = (overrides: Parameters<typeof makeServices>[0]) => {
  const s = makeServices(overrides);
  return createNextActionsService(
    s.artifactApprovalService as never,
    s.blueprintService as never,
    s.featureService as never,
    s.featureWorkstreamService as never,
    s.milestoneService as never,
    s.projectSetupService as never,
    s.questionnaireService as never,
    s.onePagerService as never,
    s.productSpecService as never,
    s.userFlowService as never,
  );
};

describe("nextActionsService — milestone/feature routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial milestone generation", () => {
    it("returns milestones_generate when no milestones exist", async () => {
      const service = makeService({ milestones: [] });
      const { actions } = await service.build(USER_ID, PROJECT_ID);
      expect(actions[0]?.key).toBe("milestones_generate");
    });

    it("returns features_create when the active milestone exists but has no features yet", async () => {
      const service = makeService({
        milestones: [makeMilestone({ id: "m1", status: "approved", featureCount: 0, isActive: true })],
      });
      const { actions } = await service.build(USER_ID, PROJECT_ID);
      expect(actions[0]?.key).toBe("features_create");
    });
  });

  describe("draft milestones alongside approved ones (fix-job milestone scenario)", () => {
    it("returns milestone_design_generate for a draft milestone with no design doc, even when other milestones are approved", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "completed", featureCount: 3, isActive: false, position: 1 }),
        makeMilestone({ id: "m2", status: "completed", featureCount: 2, isActive: false, position: 2 }),
        makeMilestone({ id: "m3", status: "draft", featureCount: 0, isActive: true, position: 3 }),
      ];
      const service = makeService({ milestones, designDoc: null });
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      expect(actions[0]?.key).toBe("milestone_design_generate");
      expect(actions[0]?.href).toContain("/milestones/m3");
    });

    it("returns milestones_approve for a draft milestone that already has a design doc", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "completed", featureCount: 3, isActive: false, position: 1 }),
        makeMilestone({ id: "m2", status: "completed", featureCount: 2, isActive: false, position: 2 }),
        makeMilestone({ id: "m3", status: "draft", featureCount: 0, isActive: true, position: 3 }),
      ];
      const service = makeService({ milestones, designDoc: { id: "doc-1" } });
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      expect(actions[0]?.key).toBe("milestones_approve");
    });

    it("processes the first draft milestone when multiple draft milestones exist", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "completed", featureCount: 2, isActive: false, position: 1 }),
        makeMilestone({ id: "m2", status: "draft", featureCount: 0, isActive: true, position: 2 }),
        makeMilestone({ id: "m3", status: "draft", featureCount: 0, isActive: false, position: 3 }),
      ];
      const service = makeService({ milestones, designDoc: null });
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      expect(actions[0]?.key).toBe("milestone_design_generate");
      expect(actions[0]?.href).toContain("/milestones/m2");
    });
  });

  describe("approved milestones without features", () => {
    it("returns features_create for the first approved milestone that has no features", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "completed", featureCount: 3, isActive: false, position: 1 }),
        makeMilestone({ id: "m2", status: "approved", featureCount: 0, isActive: true, position: 2 }),
        makeMilestone({ id: "m3", status: "draft", featureCount: 0, isActive: false, position: 3 }),
      ];
      const service = makeService({ milestones, features: [makeFeature("f1", "m1")] });
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      expect(actions[0]?.key).toBe("features_create");
      expect(actions[0]?.href).toContain("milestone=m2");
    });

    it("returns features_create when first milestone has features but a later one does not", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "completed", featureCount: 2, isActive: false, position: 1 }),
        makeMilestone({ id: "m2", status: "completed", featureCount: 2, isActive: false, position: 2 }),
        makeMilestone({ id: "m3", status: "approved", featureCount: 0, isActive: true, position: 3 }),
      ];
      const features = [makeFeature("f1", "m1"), makeFeature("f2", "m2")];
      const service = makeService({ milestones, features });
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      expect(actions[0]?.key).toBe("features_create");
      expect(actions[0]?.href).toContain("milestone=m3");
    });

    it("does not return features_create when all approved milestones have features", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "approved", featureCount: 2, isActive: true, position: 1 }),
        makeMilestone({ id: "m2", status: "draft", featureCount: 1, isActive: false, position: 2 }),
      ];
      const features = [makeFeature("f1", "m1"), makeFeature("f2", "m2")];
      const s = makeServices({ milestones, features });
      // Override getTracks to report that feature f1 needs a product spec created
      s.featureWorkstreamService.getTracks = vi.fn().mockResolvedValue({
        tracks: {
          product: { required: true, headRevision: null, status: "missing" },
          ux: { required: false, headRevision: null, status: "missing" },
          tech: { required: false, headRevision: null, status: "missing" },
          userDocs: { required: false, headRevision: null, status: "missing" },
          archDocs: { required: false, headRevision: null, status: "missing" },
        },
      });
      const service = createNextActionsService(
        s.artifactApprovalService as never,
        s.blueprintService as never,
        s.featureService as never,
        s.featureWorkstreamService as never,
        s.milestoneService as never,
        s.projectSetupService as never,
        s.questionnaireService as never,
        s.onePagerService as never,
        s.productSpecService as never,
        s.userFlowService as never,
      );
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      expect(actions[0]?.key).not.toBe("features_create");
      // Should advance to feature doc pipeline (product spec creation)
      expect(actions[0]?.key).toBe("feature_product_create");
    });
  });

  describe("draft milestone takes priority over missing features", () => {
    it("returns milestone_design_generate when there are both draft milestones and approved milestones without features", async () => {
      const milestones = [
        makeMilestone({ id: "m1", status: "completed", featureCount: 0, isActive: false, position: 1 }),
        makeMilestone({ id: "m2", status: "draft", featureCount: 0, isActive: true, position: 2 }),
      ];
      const service = makeService({ milestones, features: [], designDoc: null });
      const { actions } = await service.build(USER_ID, PROJECT_ID);

      // Draft milestone processing takes priority
      expect(actions[0]?.key).toBe("milestone_design_generate");
    });
  });
});
