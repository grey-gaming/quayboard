export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const parseResponse = async <T>(response: Response) => {
  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as
    | T
    | { error?: { code?: string; message?: string } };

  if (!response.ok) {
    const error =
      typeof json === "object" && json !== null && "error" in json
        ? json.error
        : undefined;
    throw new ApiError(
      response.status,
      error?.code ?? "request_failed",
      error?.message ?? "Request failed.",
    );
  }

  return json as T;
};

export const apiRequest = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  return parseResponse<T>(response);
};
