import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "../src/lib/api.js";

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fails fast when the request never resolves", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const requestPromise = apiRequest("/api/system/readiness");
    const assertion = expect(requestPromise).rejects.toMatchObject({
      code: "request_timeout",
      message:
        "The API request timed out. Check whether the API server is reachable and try again.",
      status: 504,
    });

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("rejects non-JSON responses so proxy misroutes surface clearly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", {
        headers: {
          "content-type": "text/html",
        },
        status: 200,
      }),
    );

    await expect(apiRequest("/api/system/readiness")).rejects.toMatchObject({
      code: "invalid_response",
      message:
        "The API returned a non-JSON response. Check whether the API server or /api proxy is misconfigured.",
      status: 200,
    });
  });

  it("omits the default JSON content type when the request has no body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      }),
    );

    await apiRequest<{ ok: boolean }>("/api/projects/test-project/verify-sandbox", {
      method: "POST",
    });

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(headers.has("Content-Type")).toBe(false);
  });

  it("preserves Fastify validation messages from the default error shape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 400,
          code: "FST_ERR_VALIDATION",
          error: "Bad Request",
          message: "body/sandboxConfig/memoryMb must be integer",
        }),
        {
          headers: {
            "content-type": "application/json",
          },
          status: 400,
        },
      ),
    );

    await expect(apiRequest("/api/projects/test-project")).rejects.toMatchObject({
      code: "FST_ERR_VALIDATION",
      message: "body/sandboxConfig/memoryMb must be integer",
      status: 400,
    });
  });
});
