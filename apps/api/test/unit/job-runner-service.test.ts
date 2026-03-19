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
});
