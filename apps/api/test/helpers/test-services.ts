import type { AppServices } from "../../src/app-services.js";
import { createSseHub } from "../../src/services/sse.js";

export const createStubServices = (): AppServices => ({
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
  db: {} as AppServices["db"],
  dockerService: {
    checkAvailability: async () => ({ ok: false, message: "Unavailable." }),
    verifySandboxImage: async () => ({ ok: false, message: "Unavailable." }),
  },
  githubService: {
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
    createVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCanonical: async () => null,
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
    buildProviderDefinition: () => {
      throw new Error("Not implemented in test stub.");
    },
    configureLlm: async () => undefined,
    configurePreferences: async () => undefined,
    configureRepo: async () => {
      throw new Error("Not implemented in test stub.");
    },
    configureSandbox: async () => undefined,
    getLlmDefinition: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getSetupStatus: async () => ({
      checks: [],
      llmVerified: false,
      repoConnected: false,
      sandboxVerified: false,
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
    archive: async () => undefined,
    create: async () => {
      throw new Error("Not implemented in test stub.");
    },
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
