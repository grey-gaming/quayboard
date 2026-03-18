import type {
  CreateProjectRequest,
  Job,
  JobListResponse,
  LoadLlmModelsResponse,
  NextActionsResponse,
  OnePager,
  PhaseGatesResponse,
  Project,
  ProjectListResponse,
  ProjectSetupState,
  ProjectSetupStatus,
  QuestionnaireAnswers,
  SecretMetadata,
  SystemReadiness,
  UpdateQuestionnaireAnswersRequest,
  UpsertUseCaseRequest,
  UseCase,
  UseCaseListResponse,
} from "@quayboard/shared";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const apiRequestTimeoutMs = 10_000;

const getErrorDetails = (json: unknown) => {
  if (typeof json !== "object" || json === null) {
    return null;
  }

  const nestedError =
    "error" in json && typeof json.error === "object" && json.error !== null ? json.error : null;
  const nestedCode =
    nestedError && "code" in nestedError && typeof nestedError.code === "string"
      ? nestedError.code
      : undefined;
  const nestedMessage =
    nestedError && "message" in nestedError && typeof nestedError.message === "string"
      ? nestedError.message
      : undefined;
  const rootCode = "code" in json && typeof json.code === "string" ? json.code : undefined;
  const rootMessage =
    "message" in json && typeof json.message === "string" ? json.message : undefined;

  if (!nestedCode && !nestedMessage && !rootCode && !rootMessage) {
    return null;
  }

  return {
    code: nestedCode ?? rootCode,
    message: nestedMessage ?? rootMessage,
  };
};

const parseResponse = async <T>(response: Response) => {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers?.get?.("content-type");
  if (contentType && !contentType.includes("application/json")) {
    throw new ApiError(
      response.status,
      "invalid_response",
      "The API returned a non-JSON response. Check whether the API server or /api proxy is misconfigured.",
    );
  }

  const json = (await response.json()) as T | unknown;

  if (!response.ok) {
    const error = getErrorDetails(json);
    throw new ApiError(
      response.status,
      error?.code ?? "request_failed",
      error?.message ?? "Request failed.",
    );
  }

  return json as T;
};

export const apiRequest = async <T>(path: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), apiRequestTimeoutMs);
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
      signal: controller.signal,
    });

    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        504,
        "request_timeout",
        "The API request timed out. Check whether the API server is reachable and try again.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const api = {
  approveOnePager(projectId: string) {
    return apiRequest<Project>(`/api/projects/${projectId}/complete-one-pager-onboarding`, {
      method: "POST",
    });
  },
  autoAnswerQuestionnaire(projectId: string) {
    return apiRequest<Job>(`/api/projects/${projectId}/questionnaire-answers/auto-answer`, {
      method: "POST",
    });
  },
  completeSetup(projectId: string) {
    return apiRequest<Project>(`/api/projects/${projectId}/complete-setup`, {
      method: "POST",
    });
  },
  approveUserFlows(projectId: string, acceptedWarnings: string[]) {
    return apiRequest<UseCaseListResponse>(`/api/projects/${projectId}/user-flows/approve`, {
      method: "POST",
      body: JSON.stringify({ acceptedWarnings }),
    });
  },
  createProject(payload: CreateProjectRequest) {
    return apiRequest<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createSecret(projectId: string, payload: { type: string; value: string }) {
    return apiRequest<SecretMetadata>(`/api/projects/${projectId}/secrets`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createUserFlow(projectId: string, payload: UpsertUseCaseRequest) {
    return apiRequest<UseCase>(`/api/projects/${projectId}/user-flows`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteUserFlow(userFlowId: string) {
    return apiRequest<void>(`/api/user-flows/${userFlowId}`, {
      method: "DELETE",
    });
  },
  generateDescription(projectId: string) {
    return apiRequest<Job>(`/api/projects/${projectId}/generate-description`, {
      method: "POST",
    });
  },
  generateOnePager(projectId: string, mode: "generate" | "regenerate" | "improve") {
    return apiRequest<Job>(`/api/projects/${projectId}/one-pager`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  },
  generateUserFlows(projectId: string) {
    return apiRequest<Job>(`/api/projects/${projectId}/user-flows/generate`, {
      method: "POST",
    });
  },
  getJobs(projectId?: string) {
    return apiRequest<JobListResponse>(
      projectId ? `/api/projects/${projectId}/jobs` : "/api/jobs",
    );
  },
  getNextActions(projectId: string) {
    return apiRequest<NextActionsResponse>(`/api/projects/${projectId}/next-actions`);
  },
  getOnePager(projectId: string) {
    return apiRequest<{ onePager: OnePager | null }>(`/api/projects/${projectId}/one-pager`);
  },
  getOnePagerVersions(projectId: string) {
    return apiRequest<{ versions: OnePager[] }>(
      `/api/projects/${projectId}/one-pager/versions`,
    );
  },
  getPhaseGates(projectId: string) {
    return apiRequest<PhaseGatesResponse>(`/api/projects/${projectId}/phase-gates`);
  },
  getProject(projectId: string) {
    return apiRequest<Project>(`/api/projects/${projectId}`);
  },
  getProjectSetup(projectId: string) {
    return apiRequest<ProjectSetupState>(`/api/projects/${projectId}/setup`);
  },
  getQuestionnaireAnswers(projectId: string) {
    return apiRequest<QuestionnaireAnswers>(
      `/api/projects/${projectId}/questionnaire-answers`,
    );
  },
  getSetupStatus(projectId: string) {
    return apiRequest<ProjectSetupStatus>(`/api/projects/${projectId}/setup-status`);
  },
  getSystemReadiness() {
    return apiRequest<SystemReadiness>("/api/system/readiness");
  },
  getUserFlows(projectId: string) {
    return apiRequest<UseCaseListResponse>(`/api/projects/${projectId}/user-flows`);
  },
  listProjects() {
    return apiRequest<ProjectListResponse>("/api/projects");
  },
  patchQuestionnaireAnswers(
    projectId: string,
    payload: UpdateQuestionnaireAnswersRequest,
  ) {
    return apiRequest<QuestionnaireAnswers>(
      `/api/projects/${projectId}/questionnaire-answers`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },
  restoreOnePagerVersion(projectId: string, version: number) {
    return apiRequest<OnePager>(`/api/projects/${projectId}/one-pager/versions/${version}/restore`, {
      method: "POST",
    });
  },
  loadLlmModels(projectId: string, payload: { provider: "ollama" }) {
    return apiRequest<LoadLlmModelsResponse>(`/api/projects/${projectId}/llm-models`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  runUserFlowDeduplication(projectId: string) {
    return apiRequest<Job>(`/api/projects/${projectId}/user-flows/deduplicate`, {
      method: "POST",
    });
  },
  updateProject(
    projectId: string,
    payload: {
      description?: string | null;
      evidencePolicy?: {
        requireArchitectureDocs: boolean;
        requireUserDocs: boolean;
      };
      llmConfig?: {
        model: string;
        provider: "ollama" | "openai";
      };
      name?: string;
      repoConfig?: {
        owner: string;
        provider: "github";
        repo: string;
      };
      sandboxConfig?: {
        allowlist: string[];
        cpuLimit: number;
        egressPolicy: "allowlisted" | "locked";
        memoryMb: number;
        timeoutSeconds: number;
      };
    },
  ) {
    return apiRequest<Project>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  updateUserFlow(userFlowId: string, payload: UpsertUseCaseRequest) {
    return apiRequest<UseCase>(`/api/user-flows/${userFlowId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  validateGithubPat(projectId: string, payload: { pat: string }) {
    return apiRequest<ProjectSetupState>(`/api/projects/${projectId}/github-pat/validate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  verifyLlm(projectId: string) {
    return apiRequest<ProjectSetupStatus>(`/api/projects/${projectId}/verify-llm`, {
      method: "POST",
    });
  },
  verifySandbox(projectId: string) {
    return apiRequest<ProjectSetupStatus>(`/api/projects/${projectId}/verify-sandbox`, {
      method: "POST",
    });
  },
};
