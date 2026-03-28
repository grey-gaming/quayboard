import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJobRunnerService } from "../../src/services/jobs/job-runner-service.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";
const userId = "d3057770-eca1-417a-a1c6-c00bb83a47d0";

const createDbStub = () => {
  const values = vi.fn(async () => undefined);
  const where = vi.fn(async () => []);
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  const select = vi.fn(() => ({ from }));

  return {
    insert: vi.fn(() => ({
      values,
    })),
    select,
    from,
    innerJoin,
    where,
    values,
    query: {
      milestonesTable: {
        findFirst: vi.fn(async () => null) as unknown,
      },
      useCasesTable: {
        findMany: vi.fn(async () => []),
      },
    },
  };
};

const createArtifactApprovalServiceStub = () => ({
  getApproval: vi.fn(async () => null),
});

const createApprovedArtifactApprovalServiceStub = () => ({
  getApproval: vi.fn(async () => ({
    id: "approval-id",
    projectId,
    artifactType: "blueprint_tech",
    artifactId: "technical-spec-id",
    approvedByUserId: userId,
    createdAt: "2026-03-18T00:00:00.000Z",
  })),
});

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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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

  it("rejects technical decision generation when the canonical UX spec is not approved", async () => {
    const db = createDbStub();
    const generate = vi.fn(async () => ({
      content: "[]",
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: {
        getApproval: vi.fn(async () => null),
      } as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "ux-blueprint-id",
          projectId,
          kind: "ux",
          version: 1,
          title: "UX Spec",
          markdown: "# UX Spec\n\nDraft canonical blueprint.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-tech-decision-deck",
          projectId,
          createdByUserId: userId,
          type: "GenerateDecisionDeck",
          inputs: { kind: "tech" },
        })),
        markSucceeded: vi.fn(async () => undefined),
      } as never,
      llmProviderService: {
        generate,
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
      userFlowService: {} as never,
    });

    await expect(service.run("job-tech-decision-deck")).rejects.toThrow(
      "GenerateDecisionDeck requires an approved UX Spec before technical decisions.",
    );

    expect(generate).not.toHaveBeenCalled();
  });

  it("stores a blueprint version after consistency validation passes", async () => {
    const db = createDbStub();
    const createBlueprintVersion = vi.fn(async () => ({ id: "ux-blueprint-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          ok: true,
          issues: [],
        }),
        promptTokens: 10,
        completionTokens: 12,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "UX Spec",
          markdown: "# UX Spec\n\n## UX Spec Summary\n\nAligned blueprint.",
        }),
        promptTokens: 14,
        completionTokens: 16,
      });
    const service = createJobRunnerService({
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
      blueprintService: {
        assertAcceptedDecisionDeck: vi.fn(async () => undefined),
        createBlueprintVersion,
        getCanonicalByKind: vi.fn(async () => null),
        getDecisionSelections: vi.fn(async () => [
          {
            key: "navigation-model",
            title: "Navigation model",
            category: "ux",
            selection: "Single workspace shell",
            rationale: "Keeps the main journeys coherent.",
          },
        ]),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-blueprint",
          projectId,
          createdByUserId: userId,
          type: "GenerateProjectBlueprint",
          inputs: { kind: "ux" },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
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
      userFlowService: {} as never,
    });

    await service.run("job-blueprint");

    expect(generate).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ templateId: "ValidateDecisionConsistency" }),
    );
    expect(db.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateId: "GenerateProjectBlueprint" }),
    );
    expect(createBlueprintVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        kind: "ux",
        title: "UX Spec",
        markdown: "# UX Spec\n\n## UX Spec Summary\n\nAligned blueprint.",
        source: "GenerateProjectBlueprint",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-blueprint",
      expect.objectContaining({ blueprintId: "ux-blueprint-id", kind: "ux" }),
    );
  });

  it("fails blueprint generation when consistency validation reports conflicts", async () => {
    const db = createDbStub();
    const createBlueprintVersion = vi.fn(async () => ({ id: "ux-blueprint-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi.fn(async () => ({
      content: JSON.stringify({
        ok: false,
        issues: ["Selected decision contradicts the approved Product Spec."],
      }),
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
      blueprintService: {
        assertAcceptedDecisionDeck: vi.fn(async () => undefined),
        createBlueprintVersion,
        getCanonicalByKind: vi.fn(async () => null),
        getDecisionSelections: vi.fn(async () => [
          {
            key: "spending-data-strategy",
            title: "Spending data strategy",
            category: "ux",
            selection: "No open banking",
            rationale: "Reduce setup friction.",
          },
        ]),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-blueprint",
          projectId,
          createdByUserId: userId,
          type: "GenerateProjectBlueprint",
          inputs: { kind: "ux" },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      onePagerService: {} as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved scope with open banking.",
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
      userFlowService: {} as never,
    });

    await expect(service.run("job-blueprint")).rejects.toThrow(
      "ValidateDecisionConsistency found conflicts: Selected decision contradicts the approved Product Spec.",
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "ValidateDecisionConsistency" }),
    );
    expect(createBlueprintVersion).not.toHaveBeenCalled();
    expect(markSucceeded).not.toHaveBeenCalled();
  });

  it("rejects technical blueprint generation when the canonical UX spec is not approved", async () => {
    const db = createDbStub();
    const generate = vi.fn(async () => ({
      content: JSON.stringify({
        ok: true,
        issues: [],
      }),
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: {
        getApproval: vi.fn(async () => null),
      } as never,
      blueprintService: {
        assertAcceptedDecisionDeck: vi.fn(async () => undefined),
        getCanonicalByKind: vi.fn(async () => ({
          id: "ux-blueprint-id",
          projectId,
          kind: "ux",
          version: 1,
          title: "UX Spec",
          markdown: "# UX Spec\n\nDraft canonical blueprint.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
        getDecisionSelections: vi.fn(async () => []),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-tech-blueprint",
          projectId,
          createdByUserId: userId,
          type: "GenerateProjectBlueprint",
          inputs: { kind: "tech" },
        })),
        markSucceeded: vi.fn(async () => undefined),
      } as never,
      llmProviderService: {
        generate,
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
      userFlowService: {} as never,
    });

    await expect(service.run("job-tech-blueprint")).rejects.toThrow(
      "GenerateProjectBlueprint requires an approved UX Spec.",
    );

    expect(generate).not.toHaveBeenCalled();
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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
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
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
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

  it("rejects user-flow generation when the canonical Technical Spec is not approved", async () => {
    const db = createDbStub();
    const createMany = vi.fn(async () => []);
    const generate = vi.fn(async () => ({
      content: JSON.stringify([]),
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: {
        getApproval: vi.fn(async () => null),
      } as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => ({
          id: "technical-spec-id",
          projectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nDraft canonical implementation direction.",
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
        markSucceeded: vi.fn(async () => undefined),
      } as never,
      llmProviderService: {
        generate,
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
      "GenerateUseCases requires an approved Technical Spec before user flows can be generated.",
    );

    expect(generate).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("creates generated user flows in a single batch after full validation", async () => {
    const db = createDbStub();
    const createMany = vi.fn(async () => []);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
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

  it("normalizes generated user-flow step objects into strings before persisting", async () => {
    const db = createDbStub();
    const createMany = vi.fn(async () => []);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
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
              flowSteps: [
                {
                  action: "Open settings",
                  outcome: "The team settings page loads.",
                },
                {
                  action: "Send invite",
                  systemResponse: "The teammate receives an invitation email.",
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
        flowSteps: [
          "Open settings Outcome: The team settings page loads.",
          "Send invite Outcome: The teammate receives an invitation email.",
        ],
        source: "generated",
        title: "Invite teammate",
        userStory: "As an admin, I want to invite a teammate.",
      },
    ]);
    expect(markSucceeded).toHaveBeenCalledWith("job-generate-use-cases", {
      createdCount: 1,
    });
  });

  it("accepts generated user flows wrapped in a top-level userFlows object", async () => {
    const db = createDbStub();
    const createMany = vi.fn(async () => []);
    const markSucceeded = vi.fn(async () => undefined);
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
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
          content: JSON.stringify({
            userFlows: [
              {
                title: "Invite teammate",
                userStory: "As an admin, I want to invite a teammate.",
                entryPoint: "Team settings",
                endState: "The teammate receives an invite.",
                flowSteps: ["Open settings", "Send invite"],
              },
            ],
          }),
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
    ]);
    expect(markSucceeded).toHaveBeenCalledWith("job-generate-use-cases", {
      createdCount: 1,
    });
  });

  it("builds milestone feature generation prompts from approved planning context", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const markSucceeded = vi.fn(async () => undefined);
    const appendGeneratedFeatures = vi.fn(async () => ({
      createdIds: ["feature-2"],
      skippedCount: 0,
    }));
    const generate = vi.fn(async () => ({
      content: JSON.stringify([
        {
          title: "Milestone dashboard",
          summary: "Show milestone progress.",
          acceptanceCriteria: ["Displays approved milestones"],
          kind: "screen",
          priority: "must_have",
        },
      ]),
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: {
        getApproval: vi.fn(async (targetProjectId: string, artifactType: string) => ({
          id: `${artifactType}-approval`,
          projectId: targetProjectId,
          artifactType,
          artifactId: `${artifactType}-artifact`,
          approvedByUserId: userId,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async (_ownerUserId: string, _projectId: string, kind: string) => ({
          id: `${kind}-spec-id`,
          projectId,
          kind,
          version: 1,
          title: kind === "ux" ? "UX Spec" : "Technical Spec",
          markdown:
            kind === "ux"
              ? "# UX Spec\n\nApproved UX scope."
              : "# Technical Spec\n\nApproved technical scope.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      featureService: {
        appendGeneratedFeatures,
        assertApprovedMilestone: vi.fn(async () => undefined),
        list: vi.fn(async () => ({
          features: [
            {
              id: "feature-1",
              projectId,
              milestoneId: "earlier-milestone-id",
              milestoneTitle: "Platform",
              featureKey: "F-001",
              kind: "service",
              priority: "must_have",
              status: "approved",
              headRevision: {
                id: "feature-revision-1",
                featureId: "feature-1",
                version: 1,
                title: "Platform setup",
                summary: "Bootstrap the shared foundations.",
                acceptanceCriteria: ["Sets up shared infrastructure"],
                source: "manual",
                createdAt: "2026-03-18T00:00:00.000Z",
              },
              taskPlanning: {
                hasTasks: false,
                taskCount: 0,
              },
              dependencyIds: [],
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
              archivedAt: null,
            },
          ],
        })),
      } as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-append-features",
          projectId,
          createdByUserId: userId,
          type: "GenerateMilestoneFeatureSet",
          inputs: { milestoneId: "milestone-id" },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        getCanonicalDesignDoc: vi.fn(async () => ({
          id: "design-doc-id",
          milestoneId: "milestone-id",
          title: "Foundations design",
          markdown: "# Foundations design\n\nShip the first usable planning slice.",
          source: "ManualSave",
          version: 1,
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
        list: vi.fn(async () => ({
          milestones: [
            {
              id: "earlier-milestone-id",
              projectId,
              position: 1,
              title: "Platform",
              summary: "Shared foundations.",
              status: "approved",
              linkedUserFlows: [],
              featureCount: 1,
              approvedAt: "2026-03-18T00:00:00.000Z",
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
            {
              id: "milestone-id",
              projectId,
              position: 2,
              title: "Foundations",
              summary: "First releasable slice.",
              status: "approved",
              linkedUserFlows: [],
              featureCount: 0,
              approvedAt: "2026-03-18T00:00:00.000Z",
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
          ],
          coverage: {
            approvedUserFlowCount: 1,
            coveredUserFlowCount: 1,
            uncoveredUserFlowIds: [],
          },
        })),
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "overview-id",
          projectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview\n\nApproved project intent.",
          source: "ManualSave",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved product scope.",
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
              projectId,
              title: "Plan milestone",
              userStory: "As a planner, I need milestone scope.",
              entryPoint: "Mission Control",
              endState: "The milestone is ready for feature planning.",
              flowSteps: ["Review specs", "Approve milestone"],
              coverageTags: ["happy-path"],
              acceptanceCriteria: ["The milestone has clear scope."],
              doneCriteriaRefs: ["DC-1"],
              source: "manual",
              archivedAt: null,
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
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

    await service.run("job-append-features");

    const prompt =
      (
        generate as unknown as {
          mock: { calls: Array<[unknown, string, unknown]> };
        }
      ).mock.calls[0]?.[1] ?? "";

    expect(generate).toHaveBeenCalledWith(
      { provider: "openai", model: "gpt-4.1" },
      expect.stringContaining("Selected milestone design document:"),
      { responseFormat: "json" },
    );
    expect(generate).toHaveBeenCalledTimes(2);
    expect(prompt).toContain("Approved project Product Spec:");
    expect(prompt).toContain("Approved project UX Spec:");
    expect(prompt).toContain("Approved project Technical Spec:");
    expect(prompt).toContain("User flows linked to the selected milestone:");
    expect(prompt).toContain("Ordered milestone list:");
    expect(prompt).toContain("Platform setup");
    const reviewPrompt =
      (
        generate as unknown as {
          mock: { calls: Array<[unknown, string, unknown]> };
        }
      ).mock.calls[1]?.[1] ?? "";
    expect(reviewPrompt).toContain("Review the full set as a whole");
    expect(reviewPrompt).toContain("First-pass draft feature set:");
    expect(appendGeneratedFeatures).toHaveBeenCalledWith(
      expect.objectContaining({
        milestoneId: "milestone-id",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-append-features",
      expect.objectContaining({ createdCount: 1 }),
    );
  });

  it("persists the repaired milestone plan after a review pass", async () => {
    const db = createDbStub();
    const markSucceeded = vi.fn(async () => undefined);
    const createMilestone = vi.fn(async () => ({ id: "created-milestone" }));
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify([
          {
            title: "Milestone 1: Foundations",
            summary: "Initial project setup and platform basics.",
            useCaseIds: ["flow-1"],
          },
        ]),
        promptTokens: 10,
        completionTokens: 12,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify([
          {
            title: "Foundations",
            summary: "Initial project setup and platform basics.",
            useCaseIds: ["flow-1"],
          },
        ]),
        promptTokens: 11,
        completionTokens: 13,
      });
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonical: vi.fn(async () => ({
          uxBlueprint: {
            id: "ux-blueprint-id",
            projectId,
            kind: "ux",
            version: 1,
            title: "UX Spec",
            markdown: "# UX Spec\n\nApproved UX direction.",
            source: "ManualSave",
            isCanonical: true,
            createdAt: "2026-03-18T00:00:00.000Z",
          },
          techBlueprint: {
            id: "tech-blueprint-id",
            projectId,
            kind: "tech",
            version: 1,
            title: "Technical Spec",
            markdown: "# Technical Spec\n\nApproved implementation direction.",
            source: "ManualSave",
            isCanonical: true,
            createdAt: "2026-03-18T00:00:00.000Z",
          },
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-milestones",
          projectId,
          createdByUserId: userId,
          type: "GenerateMilestones",
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        create: createMilestone,
      } as never,
      onePagerService: {} as never,
      productSpecService: {} as never,
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
      questionnaireService: {} as never,
      userFlowService: {
        list: vi.fn(async () => ({
          userFlows: [
            {
              id: "flow-1",
              title: "Plan milestones",
              userStory: "As a planner, I want milestone sequencing.",
              entryPoint: "Mission Control",
              endState: "Approved milestones exist.",
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

    await service.run("job-milestones");

    expect(generate).toHaveBeenCalledTimes(2);
    expect(db.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ templateId: "GenerateMilestones" }),
    );
    expect(db.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateId: "GenerateMilestonesReview" }),
    );
    expect(createMilestone).toHaveBeenCalledWith(
      userId,
      projectId,
      {
        title: "Foundations",
        summary: "Initial project setup and platform basics.",
        useCaseIds: ["flow-1"],
      },
      "job-milestones",
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-milestones",
      expect.objectContaining({ createdCount: 1 }),
    );
  });

  it("persists the repaired milestone design doc after review and consistency passes", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      projectId,
      position: 2,
      title: "Workflow Automation",
      summary: "Automate project planning progression.",
      status: "draft",
    });
    (db.where as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        title: "Run auto-advance",
        userStory: "As a planner, I want automated planning progression.",
        entryPoint: "Mission Control",
        endState: "The project advances automatically.",
      },
    ]);
    const createDesignDocVersion = vi.fn(async () => ({ id: "design-doc-id" }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Workflow Automation Design",
          markdown: "# Workflow Automation\n\nShip the rest in a later milestone.",
        }),
        promptTokens: 10,
        completionTokens: 12,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Workflow Automation Design",
          markdown:
            "# Workflow Automation\n\nCarry dependent setup from Foundations and complete this milestone's scope here.",
        }),
        promptTokens: 11,
        completionTokens: 13,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Workflow Automation Design",
          markdown:
            "# Workflow Automation\n\nCoordinate with Foundations and keep all required work explicit in this milestone.",
        }),
        promptTokens: 12,
        completionTokens: 14,
      });
    const service = createJobRunnerService({
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonical: vi.fn(async () => ({
          uxBlueprint: {
            id: "ux-blueprint-id",
            projectId,
            kind: "ux",
            version: 1,
            title: "UX Spec",
            markdown: "# UX Spec\n\nApproved UX direction.",
            source: "ManualSave",
            isCanonical: true,
            createdAt: "2026-03-18T00:00:00.000Z",
          },
          techBlueprint: {
            id: "tech-blueprint-id",
            projectId,
            kind: "tech",
            version: 1,
            title: "Technical Spec",
            markdown: "# Technical Spec\n\nApproved implementation direction.",
            source: "ManualSave",
            isCanonical: true,
            createdAt: "2026-03-18T00:00:00.000Z",
          },
        })),
      } as never,
      db: db as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-milestone-design",
          projectId,
          createdByUserId: userId,
          type: "GenerateMilestoneDesign",
          inputs: { milestoneId: "milestone-id" },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        getContext: vi.fn(async () => ({
          id: "milestone-id",
          projectId,
          status: "draft",
          ownerUserId: userId,
        })),
        list: vi.fn(async () => ({
          milestones: [
            {
              id: "milestone-foundations",
              projectId,
              position: 1,
              title: "Foundations",
              summary: "Core setup",
              status: "approved",
              linkedUserFlows: [],
              featureCount: 1,
              approvedAt: "2026-03-18T00:00:00.000Z",
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
            {
              id: "milestone-id",
              projectId,
              position: 2,
              title: "Workflow Automation",
              summary: "Automate project planning progression.",
              status: "draft",
              linkedUserFlows: [],
              featureCount: 0,
              approvedAt: null,
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
          ],
          coverage: {
            approvedUserFlowCount: 1,
            coveredUserFlowCount: 1,
            uncoveredUserFlowIds: [],
          },
        })),
        getCanonicalDesignDoc: vi.fn(async (_ownerUserId: string, targetMilestoneId: string) => {
          if (targetMilestoneId === "milestone-foundations") {
            return {
              id: "design-foundations",
              milestoneId: "milestone-foundations",
              version: 1,
              title: "Foundations Design",
              markdown: "# Foundations\n\nCore setup happens here.",
              source: "GenerateMilestoneDesign",
              isCanonical: true,
              createdAt: new Date("2026-03-18T00:00:00.000Z"),
            };
          }

          return null;
        }),
        createDesignDocVersion,
      } as never,
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
      userFlowService: {} as never,
    });

    await service.run("job-milestone-design");

    expect(generate).toHaveBeenCalledTimes(3);
    expect(db.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ templateId: "GenerateMilestoneDesign" }),
    );
    expect(db.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateId: "GenerateMilestoneDesignReview" }),
    );
    expect(db.values).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ templateId: "GenerateMilestoneDesignConsistencyReview" }),
    );
    expect(createDesignDocVersion).toHaveBeenCalledWith({
      milestoneId: "milestone-id",
      title: "Workflow Automation Design",
      markdown:
        "# Workflow Automation\n\nCoordinate with Foundations and keep all required work explicit in this milestone.",
      source: "GenerateMilestoneDesign",
      createdByJobId: "job-milestone-design",
    });
    expect(markSucceeded).toHaveBeenCalledWith("job-milestone-design", {
      designDocId: "design-doc-id",
    });
  });

  it("rejects milestone feature generation when the milestone design document is missing", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const generate = vi.fn(async () => ({
      content: "[]",
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async (_ownerUserId: string, targetProjectId: string, kind: string) => ({
          id: `${kind}-spec-id`,
          projectId: targetProjectId,
          kind,
          version: 1,
          title: kind === "ux" ? "UX Spec" : "Technical Spec",
          markdown: "# Spec\n\nApproved scope.",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      featureService: {
        assertApprovedMilestone: vi.fn(async () => undefined),
        list: vi.fn(async () => ({ features: [] })),
      } as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-append-features",
          projectId,
          createdByUserId: userId,
          type: "GenerateMilestoneFeatureSet",
          inputs: { milestoneId: "milestone-id" },
        })),
        markSucceeded: vi.fn(async () => undefined),
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        getCanonicalDesignDoc: vi.fn(async () => null),
        list: vi.fn(async () => ({
          milestones: [],
          coverage: {
            approvedUserFlowCount: 0,
            coveredUserFlowCount: 0,
            uncoveredUserFlowIds: [],
          },
        })),
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "overview-id",
          projectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview\n\nApproved project intent.",
          source: "ManualSave",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved product scope.",
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
          userFlows: [],
          coverage: {
            warnings: [],
            acceptedWarnings: [],
          },
          approvedAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
    });

    await expect(service.run("job-append-features")).rejects.toThrow(
      "GenerateMilestoneFeatureSet requires a canonical milestone design document.",
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("replaces the active milestone feature set when rewriting milestone coverage", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const replaceGeneratedMilestoneFeatures = vi.fn(async () => ({
      archivedCount: 2,
      createdIds: ["feature-1", "feature-2"],
    }));
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi.fn(async () => ({
      content: JSON.stringify([
        {
          title: "Cross-feature orchestration",
          summary: "Fix the interaction boundary between milestone features.",
          acceptanceCriteria: ["Shared orchestration flow is covered."],
          kind: "system",
          priority: "must_have",
        },
      ]),
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async (_ownerUserId: string, targetProjectId: string, kind: string) => ({
          id: `${kind}-spec-id`,
          projectId: targetProjectId,
          kind,
          version: 1,
          title: kind === "ux" ? "UX Spec" : "Technical Spec",
          markdown: `# ${kind} spec`,
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      featureService: {
        assertApprovedMilestone: vi.fn(async () => undefined),
        list: vi.fn(async () => ({
          features: [
            {
              id: "feature-a",
              projectId,
              milestoneId: "milestone-id",
              milestoneTitle: "Foundations",
              featureKey: "F-001",
              kind: "service",
              priority: "must_have",
              status: "draft",
              headRevision: {
                id: "feature-a-revision",
                featureId: "feature-a",
                version: 1,
                title: "Notifications",
                summary: "Handle milestone notifications.",
                acceptanceCriteria: ["Notifications are delivered."],
                source: "manual",
                createdAt: "2026-03-18T00:00:00.000Z",
              },
              documents: {
                product: { required: true, state: "accepted" },
                ux: { required: true, state: "draft" },
                tech: { required: true, state: "draft" },
                userDocs: { required: false, state: "missing" },
                archDocs: { required: false, state: "missing" },
              },
              taskPlanning: { hasTasks: false, taskCount: 0 },
              dependencyIds: [],
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
              archivedAt: null,
            },
          ],
        })),
        replaceGeneratedMilestoneFeatures,
      } as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-catch-up",
          projectId,
          createdByUserId: userId,
          type: "RewriteMilestoneFeatureSet",
          inputs: { milestoneId: "milestone-id", hint: "Create missing ADR docs." },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        assertActiveMilestone: vi.fn(async () => undefined),
        getCanonicalDesignDoc: vi.fn(async () => ({
          id: "design-doc-id",
          milestoneId: "milestone-id",
          version: 1,
          title: "Milestone Design",
          markdown: "# Milestone Design",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
        list: vi.fn(async () => ({
          milestones: [
            {
              id: "milestone-id",
              projectId,
              position: 1,
              title: "Foundations",
              summary: "First releasable slice.",
              status: "approved",
              linkedUserFlows: [{ id: "flow-1", title: "Plan milestone" }],
              featureCount: 1,
              isActive: true,
              approvedAt: "2026-03-18T00:00:00.000Z",
              completedAt: null,
              reconciliationStatus: "failed_first_pass",
              reconciliationIssues: [],
              reconciliationReviewedAt: "2026-03-18T00:00:00.000Z",
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
          ],
          coverage: {
            approvedUserFlowCount: 1,
            coveredUserFlowCount: 1,
            uncoveredUserFlowIds: [],
          },
        })),
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "overview-id",
          projectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview",
          source: "ManualSave",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec",
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
      userFlowService: {} as never,
    });

    await service.run("job-catch-up");

    expect(generate).toHaveBeenCalledTimes(2);
    expect(
      (
        generate as unknown as {
          mock: { calls: Array<[unknown, string, unknown]> };
        }
      ).mock.calls[1]?.[1] ?? "",
    ).toContain("First-pass rewritten feature set:");
    expect(replaceGeneratedMilestoneFeatures).toHaveBeenCalledWith(
      expect.objectContaining({
        milestoneId: "milestone-id",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith(
      "job-catch-up",
      expect.objectContaining({
        archivedCount: 2,
        createdCount: 2,
        milestoneId: "milestone-id",
      }),
    );
  });

  it("reports rewrite-specific validation errors for unsupported feature enums", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async (_ownerUserId: string, targetProjectId: string, kind: string) => ({
          id: `${kind}-spec-id`,
          projectId: targetProjectId,
          kind,
          version: 1,
          title: kind === "ux" ? "UX Spec" : "Technical Spec",
          markdown: `# ${kind} spec`,
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      db: db as never,
      featureService: {
        assertApprovedMilestone: vi.fn(async () => undefined),
        list: vi.fn(async () => ({ features: [] })),
        replaceGeneratedMilestoneFeatures: vi.fn(async () => ({
          archivedCount: 0,
          createdIds: [],
        })),
      } as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-catch-up",
          projectId,
          createdByUserId: userId,
          type: "RewriteMilestoneFeatureSet",
          inputs: { milestoneId: "milestone-id", hint: "Create missing ADR docs." },
        })),
        markSucceeded: vi.fn(async () => undefined),
      } as never,
      llmProviderService: {
        generate: vi.fn(async () => ({
          content: JSON.stringify([
            {
              title: "Complete Initial ADR Set",
              summary: "Add the missing ADRs.",
              acceptanceCriteria: ["ADR-0004 and ADR-0005 exist."],
              kind: "backend",
              priority: "high",
            },
          ]),
          promptTokens: 10,
          completionTokens: 12,
        })),
      } as never,
      milestoneService: {
        assertActiveMilestone: vi.fn(async () => undefined),
        getCanonicalDesignDoc: vi.fn(async () => ({
          id: "design-doc-id",
          milestoneId: "milestone-id",
          version: 1,
          title: "Milestone Design",
          markdown: "# Milestone Design",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
        list: vi.fn(async () => ({
          milestones: [
            {
              id: "milestone-id",
              projectId,
              position: 1,
              title: "Foundations",
              summary: "First releasable slice.",
              status: "approved",
              linkedUserFlows: [],
              featureCount: 0,
              isActive: true,
              approvedAt: "2026-03-18T00:00:00.000Z",
              completedAt: null,
              reconciliationStatus: "failed_first_pass",
              reconciliationIssues: [],
              reconciliationReviewedAt: "2026-03-18T00:00:00.000Z",
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
          ],
          coverage: {
            approvedUserFlowCount: 0,
            coveredUserFlowCount: 0,
            uncoveredUserFlowIds: [],
          },
        })),
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "overview-id",
          projectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview",
          source: "ManualSave",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec",
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
      userFlowService: {} as never,
    });

    await expect(service.run("job-catch-up")).rejects.toThrow(
      "RewriteMilestoneFeatureSet returned an unsupported feature kind.",
    );
  });

  it("repairs a prose milestone coverage review into valid JSON", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: "The milestone looks fully covered overall.",
        promptTokens: 10,
        completionTokens: 8,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          complete: false,
          milestoneId: "milestone-id",
          issues: [
            {
              action: "needs_human_review",
              hint: "Clarify ownership for the missing state sync path.",
            },
          ],
        }),
        promptTokens: 12,
        completionTokens: 11,
      });
    const service = createJobRunnerService({
      artifactApprovalService: createArtifactApprovalServiceStub() as never,
      blueprintService: {} as never,
      db: db as never,
      featureService: {
        list: vi.fn(async () => ({ features: [] })),
      } as never,
      featureWorkstreamService: {} as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-review-coverage",
          projectId,
          createdByUserId: userId,
          type: "ReviewMilestoneCoverage",
          inputs: { milestoneId: "milestone-id" },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        assertActiveMilestone: vi.fn(async () => undefined),
        getCanonicalDesignDoc: vi.fn(async () => ({
          id: "design-doc-id",
          milestoneId: "milestone-id",
          version: 1,
          title: "Milestone Design",
          markdown: "# Milestone Design",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
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
      userFlowService: {} as never,
    });

    await service.run("job-review-coverage");

    expect(generate).toHaveBeenCalledTimes(2);
    expect(markSucceeded).toHaveBeenCalledWith("job-review-coverage", {
      milestoneId: "milestone-id",
      complete: false,
      issues: [
        {
          action: "needs_human_review",
          hint: "Clarify ownership for the missing state sync path.",
        },
      ],
    });
  });

  it("downgrades milestone repair plans without feature keys into actionable unresolved output", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const markSucceeded = vi.fn(async () => undefined);
    const invalidRepairPlan = JSON.stringify({
      resolved: true,
      defaultsChosen: [
        {
          issueIndex: 0,
          decision: "Keep the feature set unchanged.",
          rationale: "The gap is documentation-only and should not rewrite active features.",
        },
      ],
      operations: [
        {
          target: "milestone-design-document",
          action: "replace",
          hint: "Update the milestone wording to match the approved feature set.",
        },
      ],
      unresolvedReasons: [],
    });
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: invalidRepairPlan,
        promptTokens: 10,
        completionTokens: 10,
      })
      .mockResolvedValueOnce({
        content: invalidRepairPlan,
        promptTokens: 11,
        completionTokens: 11,
      });
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => null),
      } as never,
      db: db as never,
      featureService: {
        list: vi.fn(async () => ({ features: [] })),
      } as never,
      featureWorkstreamService: {} as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-repair-no-feature-key",
          projectId,
          createdByUserId: userId,
          type: "ResolveMilestoneCoverageIssues",
          inputs: {
            milestoneId: "milestone-id",
            issues: [{ action: "needs_human_review", hint: "Clarify ownership." }],
          },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        assertActiveMilestone: vi.fn(async () => undefined),
        getCanonicalDesignDoc: vi.fn(async () => ({
          id: "design-doc-id",
          milestoneId: "milestone-id",
          version: 1,
          title: "Milestone Design",
          markdown: "# Milestone Design",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "overview-id",
          projectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview\n\nApproved project intent.",
          source: "ManualSave",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved product scope.",
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
          userFlows: [],
          coverage: {
            warnings: [],
            acceptedWarnings: [],
          },
          approvedAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
    });

    await service.run("job-repair-no-feature-key");

    expect(markSucceeded).toHaveBeenCalledWith(
      "job-repair-no-feature-key",
      expect.objectContaining({
        resolved: false,
        operationsApplied: [],
        unresolvedReasons: [
          "ResolveMilestoneCoverageIssuesReview returned a non-executable operation without featureKey.",
        ],
      }),
    );
  });

  it("fails closed when ambiguous milestone repair references an unknown feature key", async () => {
    const db = createDbStub();
    (db.query.milestonesTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "milestone-id",
      title: "Foundations",
      summary: "First releasable slice.",
    });
    const markSucceeded = vi.fn(async () => undefined);
    const generate = vi.fn(async () => ({
      content: JSON.stringify({
        resolved: true,
        defaultsChosen: [
          {
            issueIndex: 0,
            decision: "Keep the milestone scope conservative.",
            rationale: "Avoid expanding beyond the current milestone boundary.",
          },
        ],
        operations: [
          {
            featureKey: "F-999",
            featurePatch: null,
            refresh: {
              product: true,
              ux: false,
              tech: false,
              userDocs: false,
              archDocs: false,
              tasks: false,
            },
            hint: "Clarify the missing ownership boundary conservatively.",
          },
        ],
        unresolvedReasons: [],
      }),
      promptTokens: 10,
      completionTokens: 12,
    }));
    const service = createJobRunnerService({
      artifactApprovalService: createApprovedArtifactApprovalServiceStub() as never,
      blueprintService: {
        getCanonicalByKind: vi.fn(async () => null),
      } as never,
      db: db as never,
      featureService: {
        list: vi.fn(async () => ({ features: [] })),
      } as never,
      featureWorkstreamService: {} as never,
      jobService: {
        getRawJob: vi.fn(async () => ({
          id: "job-repair",
          projectId,
          createdByUserId: userId,
          type: "ResolveMilestoneCoverageIssues",
          inputs: {
            milestoneId: "milestone-id",
            issues: [{ action: "needs_human_review", hint: "Clarify ownership." }],
          },
        })),
        markSucceeded,
      } as never,
      llmProviderService: {
        generate,
      } as never,
      milestoneService: {
        assertActiveMilestone: vi.fn(async () => undefined),
        getCanonicalDesignDoc: vi.fn(async () => ({
          id: "design-doc-id",
          milestoneId: "milestone-id",
          version: 1,
          title: "Milestone Design",
          markdown: "# Milestone Design",
          source: "ManualSave",
          isCanonical: true,
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      onePagerService: {
        getCanonical: vi.fn(async () => ({
          id: "overview-id",
          projectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview\n\nApproved project intent.",
          source: "ManualSave",
          isCanonical: true,
          approvedAt: "2026-03-18T00:00:00.000Z",
          createdAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
      productSpecService: {
        getCanonical: vi.fn(async () => ({
          id: "product-spec-id",
          projectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nApproved product scope.",
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
          userFlows: [],
          coverage: {
            warnings: [],
            acceptedWarnings: [],
          },
          approvedAt: "2026-03-18T00:00:00.000Z",
        })),
      } as never,
    });

    await service.run("job-repair");

    expect(markSucceeded).toHaveBeenCalledWith(
      "job-repair",
      expect.objectContaining({
        resolved: false,
        operationsApplied: [],
        unresolvedReasons: [
          'Repair planner referenced unknown active-milestone feature "F-999".',
        ],
      }),
    );
  });
});
