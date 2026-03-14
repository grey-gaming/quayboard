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
  promptTokens: number | null;
};

export type LlmProviderAdapter = {
  generate(input: {
    baseUrl: string | null;
    apiKey: string | null;
    model: string;
    prompt: string;
  }): Promise<GeneratedContent>;
  healthCheck(input: {
    baseUrl: string | null;
    apiKey: string | null;
  }): Promise<ProviderHealth>;
};

const parseJson = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
};

const createOllamaAdapter = (): LlmProviderAdapter => ({
  async healthCheck({ baseUrl }) {
    const response = await fetch(new URL("/api/tags", baseUrl ?? "").toString());
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

  async generate({ baseUrl, model, prompt }) {
    const response = await fetch(new URL("/api/generate", baseUrl ?? "").toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });
    const payload = await parseJson(response);

    if (!response.ok) {
      throw new Error("Ollama generation failed.");
    }

    return {
      content:
        typeof payload.response === "string"
          ? payload.response
          : "Generation returned no content.",
      promptTokens: null,
      completionTokens: null,
    };
  },
});

const createOpenAiAdapter = (): LlmProviderAdapter => ({
  async healthCheck({ apiKey, baseUrl }) {
    const response = await fetch(new URL("/models", baseUrl ?? "").toString(), {
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : "",
      },
    });
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

  async generate({ apiKey, baseUrl, model, prompt }) {
    const response = await fetch(
      new URL("/chat/completions", baseUrl ?? "").toString(),
      {
        method: "POST",
        headers: {
          Authorization: apiKey ? `Bearer ${apiKey}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );
    const payload = await parseJson(response);

    if (!response.ok) {
      throw new Error("OpenAI-compatible generation failed.");
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
    };
  },
});

export const createLlmProviderService = () => {
  const adapters: Record<ProviderDefinition["provider"], LlmProviderAdapter> = {
    ollama: createOllamaAdapter(),
    openai: createOpenAiAdapter(),
  };

  return {
    async checkHealth(definition: ProviderDefinition) {
      return adapters[definition.provider].healthCheck({
        baseUrl: definition.baseUrl,
        apiKey: definition.apiKey,
      });
    },
    async generate(definition: ProviderDefinition, prompt: string) {
      return adapters[definition.provider].generate({
        apiKey: definition.apiKey,
        baseUrl: definition.baseUrl,
        model: definition.model,
        prompt,
      });
    },
  };
};

export type LlmProviderService = ReturnType<typeof createLlmProviderService>;
