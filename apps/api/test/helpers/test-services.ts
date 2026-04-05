import type { AppServices } from "../../src/app-services.js";
import { createSseHub } from "../../src/services/sse.js";

export const createStubServices = (): AppServices => ({
  autoAdvanceService: {
    recoverRunningSessions: async () => undefined,
    getStatus: async () => ({ session: null, nextStep: null }),
    start: async () => {
      throw new Error("Not implemented in test stub.");
    },
    stop: async () => {
      throw new Error("Not implemented in test stub.");
    },
    resume: async () => {
      throw new Error("Not implemented in test stub.");
    },
    reset: async () => undefined,
    step: async () => {
      throw new Error("Not implemented in test stub.");
    },
    skipMilestoneReconciliation: async () => {
      throw new Error("Not implemented in test stub.");
    },
    onJobComplete: async () => undefined,
  },
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
  artifactStorageService: {
    copyRunArtifact: async () => ({
      contentType: "application/octet-stream",
      path: "/tmp/artifact",
      sizeBytes: 0,
    }),
    deletePath: async () => undefined,
    ensureStorageRoot: async () => "/tmp",
    ensureRunDir: async () => "/tmp",
    readArtifact: async () => Buffer.from(""),
    restoreWorkspaceSnapshot: async () => undefined,
    snapshotWorkspace: async () => "/tmp/workspace",
    writeRunArtifact: async () => ({
      contentType: "text/plain",
      path: "/tmp/artifact",
      sizeBytes: 0,
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
  contextPackService: {
    buildContextPack: async () => ({
      id: "00000000-0000-4000-8000-000000000010",
      projectId: "00000000-0000-4000-8000-000000000000",
      featureId: null,
      type: "coding",
      version: 1,
      content: "# Context",
      summary: "Context",
      stale: false,
      omissionList: [],
      sourceCoverage: [],
      createdByJobId: null,
      createdAt: new Date().toISOString(),
    }),
    buildRepoFingerprint: async () => ({
      id: "00000000-0000-4000-8000-000000000011",
      projectId: "00000000-0000-4000-8000-000000000000",
      key: "repo-fingerprint",
      content: "repo",
      sourceType: "repo",
      sourceId: null,
      createdByJobId: null,
      createdAt: new Date().toISOString(),
    }),
    assertOwnedProject: async () => ({
      id: "00000000-0000-4000-8000-000000000000",
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      name: "Stub Project",
      description: null,
      state: "READY",
      onePagerApprovedAt: null,
      userFlowsApprovedAt: null,
      userFlowsApprovalSnapshot: null,
      milestoneMapGeneratedAt: null,
      milestoneMapReviewStatus: "not_started",
      milestoneMapReviewIssues: [],
      milestoneMapReviewedAt: null,
      milestoneMapReviewLastJobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    listContextPacks: async () => [],
    listMemoryChunks: async () => [],
  },
  db: {} as AppServices["db"],
  dockerService: {
    checkAvailability: async () => ({ ok: false, message: "Unavailable." }),
    createManagedContainer: async () => "container-id",
    ensureImage: async () => undefined,
    listManagedContainers: async () => [],
    pruneManagedResources: async () => undefined,
    readLogs: async () => "",
    removeContainer: async () => undefined,
    startContainer: async () => undefined,
    stopContainer: async () => undefined,
    waitForContainer: async () => 0,
    verifySandboxImage: async () => ({ ok: false, message: "Unavailable." }),
  },
  executionSettingsService: {
    get: async () => ({
      defaultImage: "quayboard-agent-sandbox:latest",
      dockerHost: null,
      maxConcurrentRuns: 2,
      defaultTimeoutSeconds: 900,
      defaultCpuLimit: 1,
      defaultMemoryMb: 2048,
    }),
    update: async (value) => value,
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
    replaceGeneratedMilestoneFeatures: async () => ({ archivedCount: 0, createdIds: [] }),
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
    branchExists: async () => false,
    createPullRequest: async () => ({ url: "https://github.com/acme/repo/pull/1" }),
    deleteBranch: async () => ({ deleted: true, notFound: false }),
    findOpenPullRequestForHead: async () => null,
    getCommitCiStatus: async () => ({
      ref: "main",
      total: 0,
      pending: 0,
      passing: 0,
      failing: 0,
      state: "no_ci" as const,
      failures: [],
    }),
    mergePullRequest: async () => ({ merged: true, sha: "abc123" }),
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
    cancelActiveAutoAdvanceJobsForProject: async () => [],
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
    assertActiveMilestone: async () => {
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
    countMilestonesWithCanonicalDesignDocs: async () => 0,
    formatDesignDocList: async () => ({ designDocs: [] }),
    getActiveMilestone: async () => undefined,
    getCanonicalDesignDoc: async () => undefined,
    getMilestoneCiStatus: async () => null,
    getContext: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getProjectMilestones: async () => [],
    incrementAutoCatchUpCount: async () => ({
      id: "test-milestone-id",
      projectId: "test-project-id",
      position: 1,
      title: "Repository and Toolchain Foundations",
      summary:
        "Establish project README.md, AGENTS.md, ADR documentation, basic scaffolding, hello world page, and tests. Ensures all basics are in place prior to feature development.",
      status: "approved" as const,
      approvedAt: null,
      completedAt: null,
      scopeReviewStatus: "failed_first_pass" as const,
      scopeReviewIssues: [],
      scopeReviewedAt: null,
      scopeReviewLastJobId: null,
      deliveryReviewStatus: "not_started" as const,
      deliveryReviewIssues: [],
      deliveryReviewedAt: null,
      deliveryReviewLastJobId: null,
      reconciliationStatus: "failed_first_pass" as const,
      reconciliationIssues: [],
      reconciliationReviewedAt: null,
      reconciliationLastJobId: null,
      autoCatchUpCount: 1,
      createdByJobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    invalidateReconciliation: async () => undefined,
    invalidateMapReview: async () => undefined,
    getMilestoneMapMutationState: async () => ({
      existingMilestones: [],
      hasFeatures: false,
      hasLockedMilestones: false,
      replacementLocked: false,
    }),
    recordMapReviewResult: async () => undefined,
    markMapGenerated: async () => undefined,
    mergeMilestoneDeliveryBranchIfNeeded: async () => undefined,
    invalidateScopeReview: async () => undefined,
    recordScopeReviewResult: async () => undefined,
    invalidateDeliveryReview: async () => undefined,
    recordDeliveryReviewResult: async () => undefined,
    replaceDraftMilestoneMap: async () => ({
      milestones: [],
      coverage: {
        approvedUserFlowCount: 0,
        coveredUserFlowCount: 0,
        uncoveredUserFlowIds: [],
      },
      mapReview: {
        generatedAt: new Date().toISOString(),
        reviewStatus: "not_started" as const,
        reviewIssues: [],
        reviewedAt: null,
      },
    }),
    appendDraftMilestones: async () => ({
      milestones: [],
      coverage: {
        approvedUserFlowCount: 0,
        coveredUserFlowCount: 0,
        uncoveredUserFlowIds: [],
      },
      mapReview: {
        generatedAt: new Date().toISOString(),
        reviewStatus: "not_started" as const,
        reviewIssues: [],
        reviewedAt: null,
      },
    }),
    list: async () => ({
      milestones: [],
      coverage: {
        approvedUserFlowCount: 0,
        coveredUserFlowCount: 0,
        uncoveredUserFlowIds: [],
      },
      mapReview: {
        generatedAt: null,
        reviewStatus: "not_started" as const,
        reviewIssues: [],
        reviewedAt: null,
      },
    }),
    listDesignDocs: async () => [],
    recordReconciliationResult: async () => undefined,
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
    buildBatch: async () => ({ actions: [] }),
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
    deleteOwnedProject: async () => {
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
  sandboxService: {
    appendEvent: async () => {
      throw new Error("Not implemented in test stub.");
    },
    assertOwnedProject: async () => ({
      id: "00000000-0000-4000-8000-000000000000",
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      name: "Stub Project",
      description: null,
      state: "READY",
      onePagerApprovedAt: null,
      userFlowsApprovedAt: null,
      userFlowsApprovalSnapshot: null,
      milestoneMapGeneratedAt: null,
      milestoneMapReviewStatus: "not_started",
      milestoneMapReviewIssues: [],
      milestoneMapReviewedAt: null,
      milestoneMapReviewLastJobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    assertOwnedRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    attachArtifact: async () => undefined,
    cancelRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    cleanupTempWorkspaces: async () => undefined,
    captureArtifactsFromDir: async () => undefined,
    captureGitArtifacts: async () => undefined,
    cloneRepository: async () => undefined,
    createMilestoneSession: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createMilestoneCiRepairRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    disposeManagedContainer: async () => undefined,
    executeRun: async () => undefined,
    formatMilestoneSession: async () => {
      throw new Error("Not implemented in test stub.");
    },
    formatRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getEffectiveSandboxConfig: async () => ({
      allowlist: [],
      cpuLimit: 1,
      egressPolicy: "locked" as const,
      memoryMb: 1024,
      timeoutSeconds: 300,
    }),
    getEffectiveLlmDefinition: async () => ({
      provider: "openai" as const,
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      apiKey: null,
    }),
    getOptions: async () => ({
      executionSettings: {
        defaultImage: "quayboard-agent-sandbox:latest",
        dockerHost: null,
        maxConcurrentRuns: 2,
        defaultTimeoutSeconds: 900,
        defaultCpuLimit: 1,
        defaultMemoryMb: 2048,
      },
      projectRepo: null,
      runnableFeatures: [],
      codingPacks: [],
    }),
    getMilestoneSession: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getRun: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getRunArtifact: async () => {
      throw new Error("Not implemented in test stub.");
    },
    git: async () => "",
    hasStagedChanges: async () => false,
    hasWorkingTreeChanges: async () => false,
    listManagedContainers: async () => ({ containers: [] }),
    listMilestoneSessions: async () => ({ sessions: [] }),
    listRuns: async () => ({ runs: [] }),
    buildMilestoneCiFailureDocument: async () => "# CI Failure Context\n",
    ensureManagedGitignore: async () => undefined,
    cleanupTransientGitMessageFiles: async () => undefined,
    resolveDeliveryBranchPlan: async () => ({
      baseBranchName: "main",
      cloneBranchName: "main",
      targetBranchName: "quayboard/fix/f-001/test-run",
      pullRequestTitle: "Fix F-001: Stub Feature",
      pullRequestBody: "Stub branch plan.",
    }),
    resolveMilestoneRepairBranchPlan: async () => ({
      baseBranchName: "main",
      cloneBranchName: "main",
      targetBranchName: "quayboard/m-001/test-run",
      pullRequestTitle: "Repair milestone CI",
      pullRequestBody: "Stub milestone CI repair branch plan.",
    }),
    removeExcludedPublishPaths: async () => undefined,
    revertProtectedDeletionsIfNeeded: async () => undefined,
    publishPullRequestIfNeeded: async () => ({
      bootstrappedDefaultBranch: false,
      branchName: null,
      commitSha: null,
      pullRequestUrl: null,
    }),
    pruneWorkspaceSnapshots: async () => undefined,
    reconcileRuntimeState: async () => undefined,
    runMilestoneSession: async () => undefined,
    updateRunState: async () => {
      throw new Error("Not implemented in test stub.");
    },
    writeQuayboardDocs: async () => undefined,
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
    getScopedSetting: async () => null,
    getSystemSetting: async () => null,
    getProjectSetting: async () => null,
    upsertScopedSetting: async () => {
      throw new Error("Not implemented in test stub.");
    },
    upsertProjectSetting: async () => {
      throw new Error("Not implemented in test stub.");
    },
    upsertSystemSetting: async () => {
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
