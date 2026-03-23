import type {
  ArtifactApproval,
  ArtifactApprovalStateResponse,
  ArtifactType,
  BlueprintKind,
  CreateFeatureProductRevisionRequest,
  CreateFeatureWorkstreamRevisionRequest,
  CreateProjectRequest,
  DecisionCardListResponse,
  Job,
  JobListResponse,
  LoadLlmModelsResponse,
  Milestone,
  MilestoneDesignDoc,
  MilestoneDesignDocListResponse,
  MilestoneListResponse,
  NextActionsResponse,
  OnePager,
  PhaseGatesResponse,
  ProjectBlueprint,
  ProjectBlueprintListResponse,
  ProductSpec,
  Project,
  ProjectListResponse,
  ProjectSetupState,
  ProjectSetupStatus,
  QuestionnaireAnswers,
  SecretMetadata,
  SystemReadiness,
  UpdateDecisionCardsRequest,
  UpdateQuestionnaireAnswersRequest,
  Feature,
  FeatureDependencyListResponse,
  FeatureGraphResponse,
  FeatureListResponse,
  FeatureRevisionListResponse,
  FeatureRollupResponse,
  FeatureTracksResponse,
  FeatureWorkstreamRevisionListResponse,
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
const specPathSegment = (kind: BlueprintKind) => (kind === "ux" ? "ux-spec" : "technical-spec");

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
  approveProductSpec(projectId: string) {
    return apiRequest<ProductSpec>(`/api/projects/${projectId}/product-spec/approve`, {
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
  approveArtifact(projectId: string, artifactType: ArtifactType, artifactId: string) {
    return apiRequest<ArtifactApproval>(
      `/api/projects/${projectId}/artifacts/${artifactType}/${artifactId}/approve`,
      {
        method: "POST",
      },
    );
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
  generateProductSpec(projectId: string, mode: "generate" | "regenerate" | "improve") {
    return apiRequest<Job>(`/api/projects/${projectId}/product-spec`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  },
  generateSpecDecisionTiles(projectId: string, kind: BlueprintKind) {
    return apiRequest<Job>(
      `/api/projects/${projectId}/${specPathSegment(kind)}/decision-tiles/generate`,
      {
        method: "POST",
      },
    );
  },
  generateProjectSpec(projectId: string, kind: BlueprintKind) {
    return apiRequest<Job>(`/api/projects/${projectId}/${specPathSegment(kind)}`, {
      method: "POST",
    });
  },
  generateUserFlows(projectId: string) {
    return apiRequest<Job>(`/api/projects/${projectId}/user-flows/generate`, {
      method: "POST",
    });
  },
  getArtifactApprovalState(projectId: string, artifactType: ArtifactType, artifactId: string) {
    return apiRequest<ArtifactApprovalStateResponse>(
      `/api/projects/${projectId}/artifacts/${artifactType}/${artifactId}/approval`,
    );
  },
  getProjectSpec(projectId: string, kind: BlueprintKind) {
    return apiRequest<ProjectBlueprintListResponse>(
      `/api/projects/${projectId}/${specPathSegment(kind)}`,
    );
  },
  getProjectSpecVersions(projectId: string, kind: BlueprintKind) {
    return apiRequest<{ versions: ProjectBlueprint[] }>(
      `/api/projects/${projectId}/${specPathSegment(kind)}/versions`,
    );
  },
  getSpecDecisionTiles(projectId: string, kind: BlueprintKind) {
    return apiRequest<DecisionCardListResponse>(
      `/api/projects/${projectId}/${specPathSegment(kind)}/decision-tiles`,
    );
  },
  getJobs(projectId?: string) {
    return apiRequest<JobListResponse>(
      projectId ? `/api/projects/${projectId}/jobs` : "/api/jobs",
    );
  },
  getNextActions(projectId: string) {
    return apiRequest<NextActionsResponse>(`/api/projects/${projectId}/next-actions`);
  },
  getMilestones(projectId: string) {
    return apiRequest<MilestoneListResponse>(`/api/projects/${projectId}/milestones`);
  },
  createMilestone(
    projectId: string,
    payload: { summary: string; title: string; useCaseIds: string[] },
  ) {
    return apiRequest<Milestone>(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateMilestone(
    milestoneId: string,
    payload: { summary?: string; title?: string; useCaseIds?: string[] },
  ) {
    return apiRequest<Milestone>(`/api/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  transitionMilestone(milestoneId: string, action: "approve") {
    return apiRequest<Milestone>(`/api/milestones/${milestoneId}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },
  generateMilestones(projectId: string) {
    return apiRequest<Job>(`/api/projects/${projectId}/milestones/generate`, {
      method: "POST",
    });
  },
  getMilestoneDesignDocs(milestoneId: string) {
    return apiRequest<MilestoneDesignDocListResponse>(`/api/milestones/${milestoneId}/design-docs`);
  },
  generateMilestoneDesignDoc(milestoneId: string) {
    return apiRequest<Job>(`/api/milestones/${milestoneId}/design-docs`, {
      method: "POST",
    });
  },
  updateMilestoneDesignDoc(milestoneId: string, payload: { markdown: string }) {
    return apiRequest<MilestoneDesignDoc>(`/api/milestones/${milestoneId}/design-docs`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  approveMilestoneDesignDoc(milestoneId: string, revisionId: string) {
    return apiRequest<MilestoneDesignDoc>(
      `/api/milestones/${milestoneId}/design-docs/${revisionId}/approve`,
      {
        method: "POST",
      },
    );
  },
  getFeatures(projectId: string) {
    return apiRequest<FeatureListResponse>(`/api/projects/${projectId}/features`);
  },
  getFeatureRollup(projectId: string) {
    return apiRequest<FeatureRollupResponse>(`/api/projects/${projectId}/features/rollup`);
  },
  getFeatureGraph(projectId: string) {
    return apiRequest<FeatureGraphResponse>(`/api/projects/${projectId}/features/graph`);
  },
  createFeature(
    projectId: string,
    payload: {
      acceptanceCriteria: string[];
      kind: Feature["kind"];
      milestoneId: string;
      priority: Feature["priority"];
      source?: string;
      summary: string;
      title: string;
    },
  ) {
    return apiRequest<Feature>(`/api/projects/${projectId}/features`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  appendFeaturesFromOnePager(projectId: string, payload: { milestoneId: string }) {
    return apiRequest<Job>(`/api/projects/${projectId}/features/append-from-one-pager`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getFeature(featureId: string) {
    return apiRequest<Feature>(`/api/features/${featureId}`);
  },
  updateFeature(
    featureId: string,
    payload: {
      kind?: Feature["kind"];
      milestoneId?: string;
      priority?: Feature["priority"];
      status?: Exclude<Feature["status"], "archived">;
    },
  ) {
    return apiRequest<Feature>(`/api/features/${featureId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  archiveFeature(featureId: string) {
    return apiRequest<void>(`/api/features/${featureId}`, {
      method: "DELETE",
    });
  },
  getFeatureRevisions(featureId: string) {
    return apiRequest<FeatureRevisionListResponse>(`/api/features/${featureId}/revisions`);
  },
  getFeatureTracks(featureId: string) {
    return apiRequest<FeatureTracksResponse>(`/api/features/${featureId}/tracks`);
  },
  createFeatureRevision(
    featureId: string,
    payload: { acceptanceCriteria: string[]; source?: string; summary: string; title: string },
  ) {
    return apiRequest<FeatureRevisionListResponse>(`/api/features/${featureId}/revisions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getFeatureDependencies(featureId: string) {
    return apiRequest<FeatureDependencyListResponse>(`/api/features/${featureId}/dependencies`);
  },
  addFeatureDependency(featureId: string, payload: { dependsOnFeatureId: string }) {
    return apiRequest<FeatureDependencyListResponse>(`/api/features/${featureId}/dependencies`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  removeFeatureDependency(featureId: string, dependsOnFeatureId: string) {
    return apiRequest<FeatureDependencyListResponse>(
      `/api/features/${featureId}/dependencies/${dependsOnFeatureId}`,
      {
        method: "DELETE",
      },
    );
  },
  getFeatureWorkstreamRevisions(
    featureId: string,
    kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
  ) {
    const prefix =
      kind === "product"
        ? "product"
        : kind === "ux"
          ? "ux"
          : kind === "tech"
            ? "tech"
            : kind === "user_docs"
              ? "user-doc"
              : "arch-doc";
    return apiRequest<FeatureWorkstreamRevisionListResponse>(
      `/api/features/${featureId}/${prefix}-revisions`,
    );
  },
  createFeatureWorkstreamRevision(
    featureId: string,
    kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
    payload: CreateFeatureProductRevisionRequest | CreateFeatureWorkstreamRevisionRequest,
  ) {
    const prefix =
      kind === "product"
        ? "product"
        : kind === "ux"
          ? "ux"
          : kind === "tech"
            ? "tech"
            : kind === "user_docs"
              ? "user-doc"
              : "arch-doc";
    return apiRequest<FeatureWorkstreamRevisionListResponse>(
      `/api/features/${featureId}/${prefix}-revisions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  generateFeatureWorkstreamRevision(
    featureId: string,
    kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
  ) {
    const prefix =
      kind === "product"
        ? "product"
        : kind === "ux"
          ? "ux"
          : kind === "tech"
            ? "tech"
            : kind === "user_docs"
              ? "user-doc"
              : "arch-doc";
    return apiRequest<Job>(`/api/features/${featureId}/${prefix}-revisions/generate`, {
      method: "POST",
    });
  },
  approveFeatureWorkstreamRevision(
    featureId: string,
    kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
    revisionId: string,
  ) {
    const prefix =
      kind === "product"
        ? "product"
        : kind === "ux"
          ? "ux"
          : kind === "tech"
            ? "tech"
            : kind === "user_docs"
              ? "user-doc"
              : "arch-doc";
    return apiRequest<FeatureWorkstreamRevisionListResponse>(
      `/api/features/${featureId}/${prefix}-revisions/${revisionId}/approve`,
      {
        method: "POST",
      },
    );
  },
  getOnePager(projectId: string) {
    return apiRequest<{ onePager: OnePager | null }>(`/api/projects/${projectId}/one-pager`);
  },
  getOnePagerVersions(projectId: string) {
    return apiRequest<{ versions: OnePager[] }>(
      `/api/projects/${projectId}/one-pager/versions`,
    );
  },
  getProductSpec(projectId: string) {
    return apiRequest<{ productSpec: ProductSpec | null }>(
      `/api/projects/${projectId}/product-spec`,
    );
  },
  getProductSpecVersions(projectId: string) {
    return apiRequest<{ versions: ProductSpec[] }>(
      `/api/projects/${projectId}/product-spec/versions`,
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
  restoreProductSpecVersion(projectId: string, version: number) {
    return apiRequest<ProductSpec>(
      `/api/projects/${projectId}/product-spec/versions/${version}/restore`,
      {
        method: "POST",
      },
    );
  },
  restoreProjectSpecVersion(projectId: string, kind: BlueprintKind, version: number) {
    return apiRequest<ProjectBlueprint>(
      `/api/projects/${projectId}/${specPathSegment(kind)}/versions/${version}/restore`,
      {
        method: "POST",
      },
    );
  },
  updateOnePager(projectId: string, payload: { markdown: string }) {
    return apiRequest<OnePager>(`/api/projects/${projectId}/one-pager`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  updateProductSpec(projectId: string, payload: { markdown: string }) {
    return apiRequest<ProductSpec>(`/api/projects/${projectId}/product-spec`, {
      method: "PATCH",
      body: JSON.stringify(payload),
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
  saveProjectSpec(
    projectId: string,
    kind: BlueprintKind,
    payload: { markdown: string; title: string },
  ) {
    return apiRequest<ProjectBlueprint>(
      `/api/projects/${projectId}/${specPathSegment(kind)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
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
  updateSpecDecisionTiles(projectId: string, kind: BlueprintKind, payload: UpdateDecisionCardsRequest) {
    return apiRequest<DecisionCardListResponse>(
      `/api/projects/${projectId}/${specPathSegment(kind)}/decision-tiles`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },
  acceptSpecDecisionTiles(projectId: string, kind: BlueprintKind) {
    return apiRequest<DecisionCardListResponse>(
      `/api/projects/${projectId}/${specPathSegment(kind)}/decision-tiles/accept`,
      {
        method: "POST",
      },
    );
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
  getTaskPlanningSession(featureId: string) {
    return apiRequest<{
      session: {
        id: string;
        featureId: string;
        status: string;
        createdByJobId: string | null;
        createdAt: string;
        updatedAt: string;
      };
      clarifications: Array<{
        id: string;
        sessionId: string;
        position: number;
        question: string;
        context: string | null;
        status: string;
        answer: string | null;
        answerSource: string | null;
        answeredAt: string | null;
        createdAt: string;
      }>;
      tasks: Array<{
        id: string;
        sessionId: string;
        position: number;
        title: string;
        description: string;
        instructions: string | null;
        acceptanceCriteria: string[];
        status: string;
        createdByJobId: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/api/features/${featureId}/task-planning-session`);
  },
  getClarifications(featureId: string) {
    return apiRequest<{
      clarifications: Array<{
        id: string;
        sessionId: string;
        position: number;
        question: string;
        context: string | null;
        status: string;
        answer: string | null;
        answerSource: string | null;
        answeredAt: string | null;
        createdAt: string;
      }>;
    }>(`/api/features/${featureId}/task-planning-session/clarifications`);
  },
  generateClarifications(featureId: string) {
    return apiRequest<Job>(
      `/api/features/${featureId}/task-planning-session/clarifications`,
      { method: "POST", body: JSON.stringify({}) },
    );
  },
  answerClarification(featureId: string, clarificationId: string, answer: string) {
    return apiRequest<{
      id: string;
      sessionId: string;
      position: number;
      question: string;
      context: string | null;
      status: string;
      answer: string | null;
      answerSource: string | null;
      answeredAt: string | null;
      createdAt: string;
    }>(`/api/features/${featureId}/task-planning-session/clarifications/${clarificationId}`, {
      method: "PATCH",
      body: JSON.stringify({ answer }),
    });
  },
  autoAnswerClarifications(featureId: string) {
    return apiRequest<Job>(
      `/api/features/${featureId}/task-planning-session/clarifications/auto-answer`,
      { method: "POST", body: JSON.stringify({}) },
    );
  },
  generateTasks(featureId: string) {
    return apiRequest<Job>(`/api/features/${featureId}/task-planning-session/tasks/generate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  getTasks(featureId: string) {
    return apiRequest<{
      tasks: Array<{
        id: string;
        sessionId: string;
        position: number;
        title: string;
        description: string;
        instructions: string | null;
        acceptanceCriteria: string[];
        status: string;
        createdByJobId: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/api/features/${featureId}/task-planning-session/tasks`);
  },
  getImplementationRecords(featureId: string) {
    return apiRequest<{
      records: Array<{
        id: string;
        featureId: string;
        techRevisionId: string;
        commitSha: string | null;
        sandboxRunId: string | null;
        implementedAt: string;
      }>;
    }>(`/api/features/${featureId}/implementation-records`);
  },
  createImplementationRecord(
    featureId: string,
    payload: { techRevisionId: string; commitSha?: string; sandboxRunId?: string },
  ) {
    return apiRequest<{
      records: Array<{
        id: string;
        featureId: string;
        techRevisionId: string;
        commitSha: string | null;
        sandboxRunId: string | null;
        implementedAt: string;
      }>;
    }>(`/api/features/${featureId}/implementation-records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
