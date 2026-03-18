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
});
