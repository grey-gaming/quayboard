import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("undici", async () => {
  class Agent {}

  return {
    Agent,
    fetch: fetchMock,
  };
});

import { createLlmProviderService } from "../../src/services/llm-provider.js";

describe("llm provider service", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns an unavailable result when the Ollama health check fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    const service = createLlmProviderService({ requestTimeoutMs: 1_000 });
    const result = await service.checkHealth({
      apiKey: null,
      baseUrl: "http://127.0.0.1:11434",
      model: "",
      provider: "ollama",
    });

    expect(result).toEqual({
      ok: false,
      message: "Ollama is unavailable: connect ECONNREFUSED 127.0.0.1:11434.",
      models: [],
    });
  });

  it("returns an unavailable result when the OpenAI-compatible health check times out", async () => {
    const abortError = new Error("request aborted");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortError);

    const service = createLlmProviderService({ requestTimeoutMs: 321 });
    const result = await service.checkHealth({
      apiKey: "secret",
      baseUrl: "http://127.0.0.1:4000",
      model: "",
      provider: "openai",
    });

    expect(result).toEqual({
      ok: false,
      message: "OpenAI-compatible provider is unavailable: timed out after 321ms.",
      models: [],
    });
  });

  it("passes JSON mode through to Ollama generation requests", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          response: '{"ok":true}',
          done_reason: "stop",
        }),
    });

    const service = createLlmProviderService({ requestTimeoutMs: 1_000 });
    await service.generate(
      {
        apiKey: null,
        baseUrl: "http://127.0.0.1:11434",
        model: "glm-5:cloud",
        provider: "ollama",
      },
      "Return JSON.",
      { responseFormat: "json" },
    );

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        format: "json",
      }),
    );
  });

  it("passes JSON mode through to OpenAI-compatible generation requests", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"ok":true}',
              },
            },
          ],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 7,
          },
        }),
    });

    const service = createLlmProviderService({ requestTimeoutMs: 1_000 });
    await service.generate(
      {
        apiKey: "secret",
        baseUrl: "http://127.0.0.1:4000",
        model: "gpt-4.1",
        provider: "openai",
      },
      "Return JSON.",
      { responseFormat: "json" },
    );

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        response_format: {
          type: "json_object",
        },
      }),
    );
  });

  it("marks Ollama 500 generation failures as retryable provider errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({ error: "temporary overload" }),
    });

    const service = createLlmProviderService({ requestTimeoutMs: 1_000 });

    await expect(
      service.generate(
        {
          apiKey: null,
          baseUrl: "http://127.0.0.1:11434",
          model: "glm-5:cloud",
          provider: "ollama",
        },
        "Return JSON.",
        { responseFormat: "json" },
      ),
    ).rejects.toMatchObject({
      llmProviderError: expect.objectContaining({
        provider: "ollama",
        retryable: true,
        statusCode: 500,
      }),
    });
  });

  it("marks OpenAI-compatible 400 generation failures as non-retryable provider errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: { message: "invalid request" } }),
    });

    const service = createLlmProviderService({ requestTimeoutMs: 1_000 });

    await expect(
      service.generate(
        {
          apiKey: "secret",
          baseUrl: "http://127.0.0.1:4000",
          model: "gpt-4.1",
          provider: "openai",
        },
        "Return JSON.",
        { responseFormat: "json" },
      ),
    ).rejects.toMatchObject({
      llmProviderError: expect.objectContaining({
        provider: "openai",
        retryable: false,
        statusCode: 400,
      }),
    });
  });

  it("streams Ollama thinking chunks through the reasoning callback", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({ thinking: "draft plan ", response: "" })}\n`,
          ),
        );
        controller.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({
              thinking: "check repo",
              response: "final answer",
              done_reason: "stop",
            })}\n`,
          ),
        );
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body,
      text: async () => "",
    });

    const onReasoningDelta = vi.fn();
    const onTextDelta = vi.fn();
    const service = createLlmProviderService({ requestTimeoutMs: 1_000 });

    const generated = await service.generate(
      {
        apiKey: null,
        baseUrl: "http://127.0.0.1:11434",
        model: "glm-5:cloud",
        provider: "ollama",
      },
      "Return JSON.",
      {
        onStream: {
          onReasoningDelta,
          onTextDelta,
        },
      },
    );

    expect(onReasoningDelta).toHaveBeenCalledTimes(2);
    expect(onReasoningDelta).toHaveBeenNthCalledWith(1, "draft plan ");
    expect(onReasoningDelta).toHaveBeenNthCalledWith(2, "check repo");
    expect(onTextDelta).toHaveBeenCalledWith("final answer");
    expect(generated.content).toBe("final answer");
  });
});
