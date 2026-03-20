import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJobRunnerService } from "../../src/services/jobs/job-runner-service.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";
const userId = "d3057770-eca1-417a-a1c6-c00bb83a47d0";

const createDbStub = () => {
  const values = vi.fn(async () => undefined);

  return {
    insert: vi.fn(() => ({
      values,
    })),
    values,
    query: {
      useCasesTable: {
        findMany: vi.fn(async () => []),
      },
    },
  };
};

describe("job runner service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills only blank questionnaire answers during auto-answer", async () => {
    const db = createDbStub();
    const markSucceeded = vi.fn(async () => undefined);
    const getAnswers = vi.fn(async () => ({
      projectId,
      answers: {
        q1_name_and_description: "Keep this manual answer.",
        q2_who_is_it_for: "",
      },
      updatedAt: "2026-03-18T00:00:00.000Z",
      completedAt: null,
    }));
    const upsertAnswers = vi.fn(async () => ({
      projectId,
      answers: {
        q1_name_and_description: "Keep this manual answer.",
        q2_who_is_it_for: "Engineering leads.",
      },
      updatedAt: "2026-03-18T00:01:00.000Z",
      completedAt: null,
    }));
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-auto-answer",
          projectId,
          createdByUserId: userId,
          type: "AutoAnswerQuestionnaire",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate: vi.fn(async () => ({
          content: JSON.stringify({
            q1_name_and_description: "LLM should not overwrite this.",
            q2_who_is_it_for: "Engineering leads.",
          }),
          promptTokens: 10,
          completionTokens: 12,
        })),
      } as never,
      onePagerService: {} as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Governed planning workspace.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      productSpecService: {} as never,
      questionnaireService: {
        getAnswers,
        upsertAnswers,
      } as never,
      userFlowService: {} as never,
    });

    await service.run("job-auto-answer");

    expect(upsertAnswers).toHaveBeenCalledWith(projectId, {
      q2_who_is_it_for: "Engineering leads.",
    });
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-auto-answer",
      expect.objectContaining({
        answeredKeys: ["q2_who_is_it_for"],
      }),
    );
  });

  it("updates the project description when generating an overview", async () => {
    const db = createDbStub();
    const updateOwnedProject = vi.fn(async () => undefined);
    const createVersion = vi.fn(async () => ({ id: "one-pager-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-overview",
          projectId,
          createdByUserId: userId,
          type: "GenerateProjectOverview",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate: vi.fn(async () => ({
          content: JSON.stringify({
            title: "Overview",
            description: "Short project description.",
            markdown: "# Overview\n\nCanonical planning scope.",
          }),
          promptTokens: 10,
          completionTokens: 12,
        })),
      } as never,
      onePagerService: {
        createVersion,
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
        updateOwnedProject,
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      productSpecService: {} as never,
      questionnaireService: {
        getAnswers: vi.fn(async () => ({
          projectId,
          answers: {
            q1_name_and_description: "Governed planning workspace.",
          },
          updatedAt: "2026-03-18T00:00:00.000Z",
          completedAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      userFlowService: {} as never,
    });

    await service.run("job-overview");

    expect(updateOwnedProject).toHaveBeenCalledWith(userId, projectId, {
      description: "Short project description.",
    });
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        title: "Overview",
        markdown: "# Overview\n\nCanonical planning scope.",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-overview",
      expect.objectContaining({ onePagerId: "one-pager-id" }),
    );
  });

  it("stores a fresh decision deck from approved planning artifacts", async () => {
    const db = createDbStub();
    const replaceDecisionDeck = vi.fn(async () => [{ id: "card-1" }]);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        replaceDecisionDeck,
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-decision-deck",
          projectId,
          createdByUserId: userId,
          type: "GenerateDecisionDeck",
          inputs: { kind: "ux" },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate: vi.fn(async () => ({
          content: JSON.stringify([
            {
              key: "architecture-style",
              category: "tech",
              title: "Architecture style",
              prompt: "Choose the primary service boundary model.",
              recommendation: {
                id: "modular-monolith",
                label: "Modular monolith",
                description: "Keep early delivery cohesive with clear module boundaries.",
              },
              alternatives: [
                {
                  id: "service-oriented",
                  label: "Service oriented",
                  description: "Split the system into multiple collaborating services.",
                },
                {
                  id: "event-first",
                  label: "Event first",
                  description: "Lead with an event-driven architecture from the start.",
                },
              ],
            },
          ]),
          promptTokens: 10,
          completionTokens: 12,
        })),
      } as never,
      onePagerService: {} as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved scope.",
          source: "GenerateProductSpec",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {
        list: vi.fn(async () => ({
          userFlows: [
            {
              id: "flow-1",
              title: "Create project",
            },
          ],
          coverage: {
            warnings: [],
            acceptedWarnings: [],
          },
          approvedAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
    });

    await service.run("job-decision-deck");

    expect(replaceDecisionDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        kind: "ux",
        cards: [
          expect.objectContaining({
            key: "architecture-style",
            category: "tech",
            title: "Architecture style",
          }),
        ],
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith("job-decision-deck", {
      createdCount: 1,
      kind: "ux",
    });
  });

  it("stores a Product Spec version from the approved overview", async () => {
    const db = createDbStub();
    const createVersion = vi.fn(async () => ({ id: "product-spec-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Product Spec",
          markdown: "# Product Spec\n\n## Specification Gaps\n\n- Clarify defaults.",
        }),
        promptTokens: 10,
        completionTokens: 12,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Product Spec",
          markdown: "# Product Spec\n\n## Assumptions and Proposed Defaults\n\n- Default clarified.",
        }),
        promptTokens: 14,
        completionTokens: 16,
      });
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-product-spec",
          projectId,
          createdByUserId: userId,
          type: "GenerateProductSpec",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "one-pager-id",
          projectId,
          version: 2,
          title: "Overview",
          markdown: "# Overview\n\nApproved scope.",
          source: "GenerateProjectOverview",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        createVersion,
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {} as never,
    });

    await service.run("job-product-spec");

    expect(generate).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ templateId: "GenerateProductSpec" }),
    );
    expect(db.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateId: "GenerateProductSpecReview" }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        title: "Product Spec",
        markdown: "# Product Spec\n\n## Assumptions and Proposed Defaults\n\n- Default clarified.",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-product-spec",
      expect.objectContaining({ productSpecId: "product-spec-id" }),
    );
  });

  it("accepts fenced JSON from the first Product Spec pass", async () => {
    const db = createDbStub();
    const createVersion = vi.fn(async () => ({ id: "product-spec-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content:
          '```json\n{"title":"Product Spec","markdown":"# Product Spec\\n\\n## Specification Gaps\\n\\n- Clarify defaults."}\n```',
        promptTokens: 10,
        completionTokens: 12,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Product Spec",
          markdown: "# Product Spec\n\n## Assumptions and Proposed Defaults\n\n- Default clarified.",
        }),
        promptTokens: 14,
        completionTokens: 16,
      });
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-product-spec",
          projectId,
          createdByUserId: userId,
          type: "RegenerateProductSpec",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "one-pager-id",
          projectId,
          version: 2,
          title: "Overview",
          markdown: "# Overview\n\nApproved scope.",
          source: "GenerateProjectOverview",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        createVersion,
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {} as never,
    });

    await service.run("job-product-spec");

    expect(generate).toHaveBeenCalledTimes(2);
    expect(db.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ templateId: "RegenerateProductSpec" }),
    );
    expect(db.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateId: "RegenerateProductSpecReview" }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        title: "Product Spec",
        markdown: "# Product Spec\n\n## Assumptions and Proposed Defaults\n\n- Default clarified.",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-product-spec",
      expect.objectContaining({ productSpecId: "product-spec-id" }),
    );
  });

  it("fails Product Spec generation when the review pass returns invalid content", async () => {
    const db = createDbStub();
    const createVersion = vi.fn(async () => ({ id: "product-spec-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Product Spec",
          markdown: "# Product Spec\n\nDraft content.",
        }),
        promptTokens: 10,
        completionTokens: 12,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Product Spec",
          markdown: "",
        }),
        promptTokens: 14,
        completionTokens: 16,
      });
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-product-spec",
          projectId,
          createdByUserId: userId,
          type: "GenerateProductSpec",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "one-pager-id",
          projectId,
          version: 2,
          title: "Overview",
          markdown: "# Overview\n\nApproved scope.",
          source: "GenerateProjectOverview",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        createVersion,
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {} as never,
    });

    await expect(service.run("job-product-spec")).rejects.toThrow(
      'GenerateProductSpecReview returned invalid content. Expected JSON with non-empty "title" and "markdown".',
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateId: "GenerateProductSpecReview" }),
    );
    expect(createVersion).not.toHaveBeenCalled();
    expect(markSucceeded).not.toHaveBeenCalled();
  });

  it("archives duplicate user flows through the service so approval reset stays centralized", async () => {
    const db = createDbStub();
    db.query.useCasesTable.findMany = vi.fn(async () => [
      {
        id: "flow-1",
        projectId,
        title: "Invite teammate",
        userStory: "Story",
        entryPoint: "Entry",
        endState: "End",
        flowSteps: ["Step"],
        coverageTags: ["happy-path"],
        acceptanceCriteria: ["Criterion"],
        doneCriteriaRefs: ["manual"],
        source: "generated",
        archivedAt: null,
        createdByJobId: null,
        createdAt: new Date("2026-03-18T00:00:00.000Z"),
        updatedAt: new Date("2026-03-18T00:00:00.000Z"),
      },
      {
        id: "flow-2",
        projectId,
        title: "invite teammate",
        userStory: "Story",
        entryPoint: "Entry",
        endState: "End",
        flowSteps: ["Step"],
        coverageTags: ["happy-path"],
        acceptanceCriteria: ["Criterion"],
        doneCriteriaRefs: ["manual"],
        source: "generated",
        archivedAt: null,
        createdByJobId: null,
        createdAt: new Date("2026-03-18T00:00:00.000Z"),
        updatedAt: new Date("2026-03-18T00:00:00.000Z"),
      },
    ]);
    const archive = vi.fn(async () => undefined);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-dedupe",
          projectId,
          createdByUserId: userId,
          type: "DeduplicateUseCases",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {} as never,
      onePagerService: {} as never,
      productSpecService: {} as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {
        archive,
      } as never,
    });

    await service.run("job-dedupe");

    expect(archive).toHaveBeenCalledWith(userId, "flow-2");
    expect(markSucceeded).toHaveBeenCalledWith("job-dedupe", {
      archivedIds: ["flow-2"],
    });
  });

  it("validates all generated user flows before persisting any of them", async () => {
    const db = createDbStub();
    const createMany = vi.fn(async () => []);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-generate-use-cases",
          projectId,
          createdByUserId: userId,
          type: "GenerateUseCases",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate: vi.fn(async () => ({
          content: JSON.stringify([
            {
              title: "Invite teammate",
              userStory: "As an admin, I want to invite a teammate.",
              entryPoint: "Team settings",
              endState: "The teammate receives an invite.",
              flowSteps: ["Open settings", "Send invite"],
            },
            {
              title: "Broken flow",
              userStory: "As an admin, I want to recover from errors.",
              entryPoint: "Team settings",
              endState: "",
              flowSteps: ["Open settings"],
            },
          ]),
          promptTokens: 10,
          completionTokens: 12,
        })),
      } as never,
      onePagerService: {} as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved scope.",
          source: "GenerateProductSpec",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {
        createMany,
      } as never,
    });

    await expect(service.run("job-generate-use-cases")).rejects.toThrow(
      "GenerateUseCases returned an incomplete user flow. Each flow must include title, userStory, entryPoint, endState, and at least one flow step.",
    );

    expect(createMany).not.toHaveBeenCalled();
    expect(markSucceeded).not.toHaveBeenCalled();
  });

  it("creates generated user flows in a single batch after full validation", async () => {
    const db = createDbStub();
    const createMany = vi.fn(async () => []);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactReviewService: {} as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved implementation direction.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-generate-use-cases",
          projectId,
          createdByUserId: userId,
          type: "GenerateUseCases",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate: vi.fn(async () => ({
          content: JSON.stringify([
            {
              title: "Invite teammate",
              userStory: "As an admin, I want to invite a teammate.",
              entryPoint: "Team settings",
              endState: "The teammate receives an invite.",
              flowSteps: ["Open settings", "Send invite"],
            },
            {
              title: "Accept invitation",
              userStory: "As a teammate, I want to accept an invitation.",
              entryPoint: "Invitation email",
              endState: "The teammate joins the workspace.",
              flowSteps: ["Open email", "Accept invite"],
              coverageTags: ["onboarding"],
            },
          ]),
          promptTokens: 10,
          completionTokens: 12,
        })),
      } as never,
      onePagerService: {} as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved scope.",
          source: "GenerateProductSpec",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      projectService: {
        getOwnedProject: vi.fn(async () => ({
          id: projectId,
          name: "Quayboard",
          description: "Existing description.",
        })),
      } as never,
      projectSetupService: {
        getLlmDefinition: vi.fn(async () => ({
          provider: "openai",
          model: "gpt-4.1",
        })),
      } as never,
      questionnaireService: {} as never,
      userFlowService: {
        createMany,
      } as never,
    });

    await service.run("job-generate-use-cases");

    expect(createMany).toHaveBeenCalledWith(userId, projectId, [
      {
        acceptanceCriteria: ["The described flow can be completed."],
        coverageTags: ["happy-path"],
        doneCriteriaRefs: ["product-spec"],
        endState: "The teammate receives an invite.",
        entryPoint: "Team settings",
        flowSteps: ["Open settings", "Send invite"],
        source: "generated",
        title: "Invite teammate",
        userStory: "As an admin, I want to invite a teammate.",
      },
      {
        acceptanceCriteria: ["The described flow can be completed."],
        coverageTags: ["onboarding"],
        doneCriteriaRefs: ["product-spec"],
        endState: "The teammate joins the workspace.",
        entryPoint: "Invitation email",
        flowSteps: ["Open email", "Accept invite"],
        source: "generated",
        title: "Accept invitation",
        userStory: "As a teammate, I want to accept an invitation.",
      },
    ]);
    expect(markSucceeded).toHaveBeenCalledWith("job-generate-use-cases", {
      createdCount: 2,
    });
  });
});
