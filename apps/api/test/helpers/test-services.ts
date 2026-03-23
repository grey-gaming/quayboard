import type { AppServices } from "../../src/app-services.js";
import { createSseHub } from "../../src/services/sse.js";

export const createStubServices = (): AppServices => ({
  artifactApprovalService: {
    approve: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getApproval: async () => null,
    getState: async () => ({
      artifactId: "00000000-0000-4000-8000-000000000000",
      artifactType: "blueprint_ux",
      approval: null,
    }),
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
    acceptDecisionDeck: async () => ({ cards: [] }),
    assertAcceptedDecisionDeck: async () => [],
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
    getCanonicalByKind: async () => null,
    getCanonicalRecord: async () => undefined,
    getDecisionSelections: async () => [],
    listDecisionCards: async () => ({ cards: [] }),
    listVersions: async () => [],
    replaceDecisionDeck: async () => [],
    restoreVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    updateDecisionCards: async () => ({ cards: [] }),
  },
  db: {} as AppServices["db"],
  dockerService: {
    checkAvailability: async () => ({ ok: false, message: "Unavailable." }),
    verifySandboxImage: async () => ({ ok: false, message: "Unavailable." }),
  },
  featureService: {
    addDependency: async () => {
      throw new Error("Not implemented in test stub.");
    },
    appendGeneratedFeatures: async () => ({ createdIds: [], skippedCount: 0 }),
    archive: async () => ({ features: [] }),
    assertApprovedMilestone: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    buildDependencyAdjacency: async () => new Map(),
    create: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createRevision: async () => ({ revisions: [] }),
    get: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getContext: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getGraph: async () => ({ nodes: [], edges: [] }),
    getRollup: async () => ({
      totals: { active: 0, archived: 0 },
      byStatus: [],
      byKind: [],
      byPriority: [],
      byMilestone: [],
    }),
    list: async () => ({ features: [] }),
    listDependencies: async () => ({ dependencies: [] }),
    listRevisions: async () => ({ revisions: [] }),
    removeDependency: async () => ({ dependencies: [] }),
    update: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  featureWorkstreamService: {
    approveRevision: async () => ({ revisions: [] }),
    assertApprovalPrerequisites: async () => undefined,
    createRevision: async () => ({ revisions: [] }),
    ensureSpecRecord: async () => undefined,
    getApproval: async () => null,
    getFeatureContext: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getHeadRevision: async () => ({
      id: "00000000-0000-4000-8000-000000000001",
      featureId: "00000000-0000-4000-8000-000000000000",
      kind: "product",
      version: 1,
      title: "Draft Product Spec",
      markdown: "# Draft",
      source: "manual",
      createdAt: "2026-03-22T00:00:00.000Z",
      approval: null,
      requirements: {
        uxRequired: true,
        techRequired: true,
        userDocsRequired: true,
        archDocsRequired: true,
      },
    }),
    getTracks: async () => ({
      featureId: "00000000-0000-4000-8000-000000000000",
      tracks: {
        product: {
          kind: "product",
          required: true,
          status: "draft",
          headRevision: null,
          approvedRevisionId: null,
          implementationStatus: "not_implemented",
          isOutOfDate: false,
        },
        ux: {
          kind: "ux",
          required: false,
          status: "draft",
          headRevision: null,
          approvedRevisionId: null,
          implementationStatus: "not_implemented",
          isOutOfDate: false,
        },
        tech: {
          kind: "tech",
          required: false,
          status: "draft",
          headRevision: null,
          approvedRevisionId: null,
          implementationStatus: "not_implemented",
          isOutOfDate: false,
        },
        userDocs: {
          kind: "user_docs",
          required: false,
          status: "draft",
          headRevision: null,
          approvedRevisionId: null,
          implementationStatus: "not_implemented",
          isOutOfDate: false,
        },
        archDocs: {
          kind: "arch_docs",
          required: false,
          status: "draft",
          headRevision: null,
          approvedRevisionId: null,
          implementationStatus: "not_implemented",
          isOutOfDate: false,
        },
      },
    }),
    listRevisions: async () => ({ revisions: [] }),
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
    createJobIfNoActiveProjectJobOfSameKind: async () => {
      throw new Error("Not implemented in test stub.");
    },
    findActiveProjectJobByTypeAndKind: async () => null,
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
  milestoneService: {
    assertApprovedUserFlows: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertCanonicalDesignDoc: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    create: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createDesignDocVersion: async () => {
      throw new Error("Not implemented in test stub.");
    },
    formatDesignDocList: async () => ({ designDocs: [] }),
    getCanonicalDesignDoc: async () => undefined,
    getContext: async () => {
      throw new Error("Not implemented in test stub.");
    },
    list: async () => ({
      milestones: [],
      coverage: {
        approvedUserFlowCount: 0,
        coveredUserFlowCount: 0,
        uncoveredUserFlowIds: [],
      },
    }),
    listDesignDocs: async () => [],
    transition: async () => {
      throw new Error("Not implemented in test stub.");
    },
    update: async () => {
      throw new Error("Not implemented in test stub.");
    },
    validateLinkedUseCases: async () => [],
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
  taskPlanningService: {
    answerClarification: async () => {
      throw new Error("Not implemented in test stub.");
    },
    autoAnswerClarifications: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createClarifications: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createImplementationRecord: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createTasks: async () => {
      throw new Error("Not implemented in test stub.");
    },
    generateClarifications: async () => {
      throw new Error("Not implemented in test stub.");
    },
    generateTasks: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getClarifications: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getOrCreateSession: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getSession: async () => null,
    getFeatureContext: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getImplementationRecords: async () => [],
    getTasks: async () => [],
    setSessionStatus: async () => undefined,
    createTask: async () => {
      throw new Error("Not implemented in test stub.");
    },
    updateTask: async () => {
      throw new Error("Not implemented in test stub.");
    },
    deleteTask: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
});
