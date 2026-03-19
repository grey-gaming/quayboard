import type { AppServices } from "../../src/app-services.js";
import { createSseHub } from "../../src/services/sse.js";

export const createStubServices = (): AppServices => ({
  artifactReviewService: {
    approve: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getApproval: async () => null,
    getLatestRun: async () => undefined,
    getState: async () => ({
      artifactId: "00000000-0000-4000-8000-000000000000",
      artifactType: "blueprint_ux",
      latestReviewRun: null,
      openBlockerCount: 0,
      openSuggestionCount: 0,
      openWarningCount: 0,
      approval: null,
      reviewItems: [],
    }),
    listItems: async () => ({ items: [] }),
    markRunFailed: async () => null,
    markRunRunning: async () => null,
    markRunSucceeded: async () => null,
    replaceRunItems: async () => undefined,
    updateReviewItem: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  authService: {
    authenticate: async () => null,
    createSession: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCurrentUser: async () => {
      throw new Error("Not implemented in test stub.");
    },
    login: async () => {
      throw new Error("Not implemented in test stub.");
    },
    logout: async () => undefined,
    register: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  blueprintService: {
    assertCanonicalBlueprint: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertFullySelectedDecisionDeck: async () => [],
    assertOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createBlueprintVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCanonical: async () => ({
      uxBlueprint: null,
      techBlueprint: null,
    }),
    getCanonicalRecord: async () => undefined,
    getDecisionSelections: async () => [],
    listDecisionCards: async () => ({ cards: [] }),
    replaceDecisionDeck: async () => [],
    updateDecisionCards: async () => ({ cards: [] }),
  },
  db: {} as AppServices["db"],
  dockerService: {
    checkAvailability: async () => ({ ok: false, message: "Unavailable." }),
    verifySandboxImage: async () => ({ ok: false, message: "Unavailable." }),
  },
  githubService: {
    validatePat: async () => {
      throw new Error("Not implemented in test stub.");
    },
    verifyRepository: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  jobRunnerService: {
    run: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  jobScheduler: {
    start() {},
    stop() {},
  },
  jobService: {
    claimNextQueuedJob: async () => null,
    createJob: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getOwnedJob: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getRawJob: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listJobsForProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listOwnedJobs: async () => {
      throw new Error("Not implemented in test stub.");
    },
    cancelRunningJobs: async () => [],
    markFailed: async () => {
      throw new Error("Not implemented in test stub.");
    },
    markSucceeded: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  llmProviderService: {
    checkHealth: async () => ({ ok: false, message: "Unavailable.", models: [] }),
    generate: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  nextActionsService: {
    build: async () => ({ actions: [] }),
  },
  onePagerService: {
    approveCanonical: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCanonical: async () => null,
    getCanonicalRecord: async () => undefined,
    listVersions: async () => [],
    restoreVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    syncProjectFromCanonical: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  productSpecService: {
    approveCanonical: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCanonical: async () => null,
    getCanonicalRecord: async () => undefined,
    listVersions: async () => [],
    restoreVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  phaseGateService: {
    build: async () => ({ phases: [] }),
  },
  projectService: {
    createProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getOwnedProjectRecord: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listProjects: async () => {
      throw new Error("Not implemented in test stub.");
    },
    updateOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  projectSetupService: {
    assertSetupCompleted: async () => {
      throw new Error("Not implemented in test stub.");
    },
    buildProviderDefinition: () => {
      throw new Error("Not implemented in test stub.");
    },
    completeSetup: async () => {
      throw new Error("Not implemented in test stub.");
    },
    configureLlm: async () => undefined,
    configureEvidencePolicy: async () => undefined,
    configureRepo: async () => {
      throw new Error("Not implemented in test stub.");
    },
    configureSandbox: async () => undefined,
    getSetupState: async () => ({
      evidencePolicy: {
        requireArchitectureDocs: false,
        requireUserDocs: false,
      },
      llm: {
        availableModels: [],
        model: null,
        provider: null,
        verified: false,
      },
      repo: {
        availableRepos: [],
        patConfigured: false,
        selectedRepo: null,
        viewerLogin: null,
      },
      sandboxConfig: null,
      status: {
        checks: [],
        llmVerified: false,
        repoConnected: false,
        sandboxVerified: false,
      },
    }),
    getLlmDefinition: async () => {
      throw new Error("Not implemented in test stub.");
    },
    isSetupCompleted: async () => false,
    getSetupStatus: async () => ({
      checks: [],
      llmVerified: false,
      repoConnected: false,
      sandboxVerified: false,
    }),
    loadLlmModels: async () => ({ models: [] }),
    validateGithubPat: async () => ({
      evidencePolicy: {
        requireArchitectureDocs: false,
        requireUserDocs: false,
      },
      llm: {
        availableModels: [],
        model: null,
        provider: null,
        verified: false,
      },
      repo: {
        availableRepos: [],
        patConfigured: true,
        selectedRepo: null,
        viewerLogin: "stub-user",
      },
      sandboxConfig: null,
      status: {
        checks: [],
        llmVerified: false,
        repoConnected: false,
        sandboxVerified: false,
      },
    }),
    verifyLlm: async () => ({
      checks: [],
      llmVerified: false,
      repoConnected: false,
      sandboxVerified: false,
    }),
    verifySandbox: async () => ({
      checks: [],
      llmVerified: false,
      repoConnected: false,
      sandboxVerified: false,
    }),
  },
  questionnaireService: {
    getAnswers: async () => ({
      answers: {},
      completedAt: null,
      projectId: "00000000-0000-0000-0000-000000000000",
      updatedAt: new Date().toISOString(),
    }),
    getDefinition: () => [],
    upsertAnswers: async () => ({
      answers: {},
      completedAt: null,
      projectId: "00000000-0000-0000-0000-000000000000",
      updatedAt: new Date().toISOString(),
    }),
  },
  secretService: {
    buildSecretEnvMap: async () => ({}),
    createSecret: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listSecrets: async () => {
      throw new Error("Not implemented in test stub.");
    },
    upsertSecret: async () => {
      throw new Error("Not implemented in test stub.");
    },
    updateSecret: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  secretsCrypto: {
    decrypt(value: string) {
      return value;
    },
    encrypt(value: string) {
      return value;
    },
  },
  settingsService: {
    getProjectSetting: async () => null,
    upsertProjectSetting: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  sseHub: createSseHub(),
  systemReadinessService: {
    getReadiness: async () => ({ checks: [] }),
  },
  userFlowService: {
    approve: async () => ({
      approvedAt: null,
      coverage: {
        acceptedWarnings: [],
        warnings: [],
      },
      userFlows: [],
    }),
    clearApproval: async () => undefined,
    archive: async () => undefined,
    create: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createMany: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getContext: async () => ({
      projectId: "test-project-id",
    }),
    list: async () => ({
      approvedAt: null,
      coverage: {
        acceptedWarnings: [],
        warnings: [],
      },
      userFlows: [],
    }),
    update: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
});
