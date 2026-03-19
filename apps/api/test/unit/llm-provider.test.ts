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
});
