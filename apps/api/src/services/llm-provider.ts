import { Agent, fetch } from "undici";

type ProviderHealth = {
  models: string[];
  ok: boolean;
  message: string;
};

export type ProviderDefinition = {
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
  provider: "ollama" | "openai";
};

export type GeneratedContent = {
  content: string;
  completionTokens: number | null;
  doneReason?: string | null;
  evalCount?: number | null;
  promptTokens: number | null;
  promptEvalCount?: number | null;
  totalDuration?: number | null;
};

export type LlmProviderError = {
  kind: "http_error" | "transport_error";
  message: string;
  provider: ProviderDefinition["provider"];
  retryable: boolean;
  statusCode?: number;
};

export type LlmProviderAdapter = {
  generate(input: {
    baseUrl: string | null;
    apiKey: string | null;
    model: string;
    prompt: string;
    responseFormat?: "json";
  }): Promise<GeneratedContent>;
  healthCheck(input: {
    baseUrl: string | null;
    apiKey: string | null;
  }): Promise<ProviderHealth>;
};

const createLlmProviderError = (input: LlmProviderError) =>
  Object.assign(new Error(input.message), {
    llmProviderError: input,
  });

const isRetryableStatus = (statusCode: number) => statusCode === 429 || statusCode >= 500;

const parseJson = async (response: { text(): Promise<string> }) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
};

const createRequestSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeoutHandle);
    },
  };
};

const formatHealthCheckFetchError = (
  providerLabel: string,
  error: unknown,
  timeoutMs: number,
) => {
  const detail =
    error instanceof Error && error.name === "AbortError"
      ? `timed out after ${timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : "request failed";

  return `${providerLabel} is unavailable: ${detail}.`;
};

const createOllamaAdapter = (input: {
  dispatcher: Agent;
  maxOutputTokens: number;
  requestTimeoutMs: number;
}): LlmProviderAdapter => ({
  async healthCheck({ baseUrl }) {
    const timeout = createRequestSignal(input.requestTimeoutMs);
    let response;

    try {
      response = await fetch(new URL("/api/tags", baseUrl ?? "").toString(), {
        dispatcher: input.dispatcher,
        signal: timeout.signal,
      });
    } catch (error) {
      return {
        ok: false,
        message: formatHealthCheckFetchError("Ollama", error, input.requestTimeoutMs),
        models: [],
      };
    } finally {
      timeout.clear();
    }

    const payload = await parseJson(response);
    const models = Array.isArray(payload.models)
      ? payload.models
          .map((entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "name" in entry &&
            typeof entry.name === "string"
              ? entry.name
              : null,
          )
          .filter((entry): entry is string => Boolean(entry))
      : [];

    return {
      ok: response.ok,
      message: response.ok ? "Ollama is reachable." : "Ollama is unavailable.",
      models,
    };
  },

  async generate({ baseUrl, model, prompt, responseFormat }) {
    let response;
    const timeout = createRequestSignal(input.requestTimeoutMs);

    try {
      response = await fetch(new URL("/api/generate", baseUrl ?? "").toString(), {
        method: "POST",
        dispatcher: input.dispatcher,
        signal: timeout.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          ...(responseFormat === "json" ? { format: "json" } : {}),
          options: {
            num_predict: input.maxOutputTokens,
          },
          stream: false,
        }),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `timed out after ${input.requestTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : "unknown fetch failure";
      throw createLlmProviderError({
        kind: "transport_error",
        message: `Ollama generation request failed: ${message}`,
        provider: "ollama",
        retryable: true,
      });
    } finally {
      timeout.clear();
    }

    const payload = await parseJson(response);

    if (!response.ok) {
      const payloadError =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : null;
      throw createLlmProviderError({
        kind: "http_error",
        message: `Ollama generation failed with status ${response.status} ${response.statusText}${payloadError ? `: ${payloadError}` : ""}.`,
        provider: "ollama",
        retryable: isRetryableStatus(response.status),
        statusCode: response.status,
      });
    }

    return {
      content:
        typeof payload.response === "string"
          ? payload.response
          : "Generation returned no content.",
      promptTokens: null,
      completionTokens: null,
      doneReason:
        typeof payload.done_reason === "string" ? payload.done_reason : null,
      promptEvalCount:
        typeof payload.prompt_eval_count === "number" ? payload.prompt_eval_count : null,
      evalCount: typeof payload.eval_count === "number" ? payload.eval_count : null,
      totalDuration:
        typeof payload.total_duration === "number" ? payload.total_duration : null,
    };
  },
});

const createOpenAiAdapter = (input: {
  dispatcher: Agent;
  requestTimeoutMs: number;
}): LlmProviderAdapter => ({
  async healthCheck({ apiKey, baseUrl }) {
    const timeout = createRequestSignal(input.requestTimeoutMs);
    let response;

    try {
      response = await fetch(new URL("/models", baseUrl ?? "").toString(), {
        dispatcher: input.dispatcher,
        signal: timeout.signal,
        headers: {
          Authorization: apiKey ? `Bearer ${apiKey}` : "",
        },
      });
    } catch (error) {
      return {
        ok: false,
        message: formatHealthCheckFetchError(
          "OpenAI-compatible provider",
          error,
          input.requestTimeoutMs,
        ),
        models: [],
      };
    } finally {
      timeout.clear();
    }

    const payload = await parseJson(response);
    const models = Array.isArray(payload.data)
      ? payload.data
          .map((entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "id" in entry &&
            typeof entry.id === "string"
              ? entry.id
              : null,
          )
          .filter((entry): entry is string => Boolean(entry))
      : [];

    return {
      ok: response.ok,
      message: response.ok
        ? "OpenAI-compatible provider is reachable."
        : "OpenAI-compatible provider is unavailable.",
      models,
    };
  },

  async generate({ apiKey, baseUrl, model, prompt, responseFormat }) {
    let response;
    const timeout = createRequestSignal(input.requestTimeoutMs);

    try {
      response = await fetch(
        new URL("/chat/completions", baseUrl ?? "").toString(),
        {
          method: "POST",
          dispatcher: input.dispatcher,
          signal: timeout.signal,
          headers: {
            Authorization: apiKey ? `Bearer ${apiKey}` : "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            ...(responseFormat === "json"
              ? { response_format: { type: "json_object" as const } }
              : {}),
          }),
        },
      );
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `timed out after ${input.requestTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : "unknown fetch failure";
      throw createLlmProviderError({
        kind: "transport_error",
        message: `OpenAI-compatible generation request failed: ${message}`,
        provider: "openai",
        retryable: true,
      });
    } finally {
      timeout.clear();
    }

    const payload = await parseJson(response);

    if (!response.ok) {
      throw createLlmProviderError({
        kind: "http_error",
        message: `OpenAI-compatible generation failed with status ${response.status} ${response.statusText}.`,
        provider: "openai",
        retryable: isRetryableStatus(response.status),
        statusCode: response.status,
      });
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0];
    const content =
      typeof firstChoice === "object" &&
      firstChoice !== null &&
      "message" in firstChoice &&
      typeof firstChoice.message === "object" &&
      firstChoice.message !== null &&
      "content" in firstChoice.message &&
      typeof firstChoice.message.content === "string"
        ? firstChoice.message.content
        : "Generation returned no content.";

    const usage =
      typeof payload.usage === "object" && payload.usage !== null
        ? (payload.usage as {
            completion_tokens?: number;
            prompt_tokens?: number;
          })
        : {};

    return {
      content,
      promptTokens:
        typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : null,
      doneReason: null,
      promptEvalCount: null,
      evalCount: null,
      totalDuration: null,
    };
  },
});

export const createLlmProviderService = (input?: {
  maxOutputTokens?: number;
  requestTimeoutMs?: number;
}) => {
  const requestTimeoutMs = input?.requestTimeoutMs ?? 900000;
  const maxOutputTokens = input?.maxOutputTokens ?? 50000;
  const dispatcher = new Agent({
    bodyTimeout: requestTimeoutMs,
    headersTimeout: requestTimeoutMs,
  });
  const adapters: Record<ProviderDefinition["provider"], LlmProviderAdapter> = {
    ollama: createOllamaAdapter({
      dispatcher,
      maxOutputTokens,
      requestTimeoutMs,
    }),
    openai: createOpenAiAdapter({
      dispatcher,
      requestTimeoutMs,
    }),
  };

  return {
    async checkHealth(definition: ProviderDefinition) {
      return adapters[definition.provider].healthCheck({
        baseUrl: definition.baseUrl,
        apiKey: definition.apiKey,
      });
    },
    async generate(
      definition: ProviderDefinition,
      prompt: string,
      options?: { responseFormat?: "json" },
    ) {
      return adapters[definition.provider].generate({
        apiKey: definition.apiKey,
        baseUrl: definition.baseUrl,
        model: definition.model,
        prompt,
        responseFormat: options?.responseFormat,
      });
    },
  };
};

export type LlmProviderService = ReturnType<typeof createLlmProviderService>;
