import type { ArtifactApprovalService } from "./artifact-approval-service.js";
import type { BlueprintService } from "./blueprint-service.js";
import type { FeatureService } from "./feature-service.js";
import type { MilestoneService } from "./milestone-service.js";
import type { OnePagerService } from "./one-pager-service.js";
import type { ProductSpecService } from "./product-spec-service.js";
import type { ProjectSetupService } from "./project-setup-service.js";
import type { QuestionnaireService } from "./questionnaire-service.js";
import type { UserFlowService } from "./user-flow-service.js";

export const createPhaseGateService = (
  artifactApprovalService: ArtifactApprovalService,
  blueprintService: BlueprintService,
  featureService: FeatureService,
  milestoneService: MilestoneService,
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  userFlowService: UserFlowService,
) => ({
  async build(ownerUserId: string, projectId: string) {
    const [
      onePager,
      productSpec,
      setupStatus,
      setupCompleted,
      questionnaire,
      userFlows,
      uxDecisionCards,
      techDecisionCards,
      blueprints,
    ] = await Promise.all([
      onePagerService.getCanonical(ownerUserId, projectId),
      productSpecService.getCanonical(ownerUserId, projectId),
      projectSetupService.getSetupStatus(ownerUserId, projectId),
      projectSetupService.isSetupCompleted(ownerUserId, projectId),
      questionnaireService.getAnswers(projectId),
      userFlowService.list(ownerUserId, projectId),
      blueprintService.listDecisionCards(ownerUserId, projectId, "ux"),
      blueprintService.listDecisionCards(ownerUserId, projectId, "tech"),
      blueprintService.getCanonical(ownerUserId, projectId),
    ]);

    const setupPassed = setupCompleted;
    const overviewPassed = Boolean(onePager?.approvedAt);
    const productSpecPassed = overviewPassed && Boolean(productSpec?.approvedAt);
    const uxDecisionGenerated = uxDecisionCards.cards.length > 0;
    const uxDecisionSelected =
      uxDecisionGenerated &&
      uxDecisionCards.cards.every((card) => card.selectedOptionId || card.customSelection);
    const uxDecisionAccepted =
      uxDecisionSelected && uxDecisionCards.cards.every((card) => Boolean(card.acceptedAt));
    const techDecisionGenerated = techDecisionCards.cards.length > 0;
    const techDecisionSelected =
      techDecisionGenerated &&
      techDecisionCards.cards.every((card) => card.selectedOptionId || card.customSelection);
    const techDecisionAccepted =
      techDecisionSelected && techDecisionCards.cards.every((card) => Boolean(card.acceptedAt));
    const uxGenerated = Boolean(blueprints.uxBlueprint);
    const techGenerated = Boolean(blueprints.techBlueprint);
    const [uxState, techState] = await Promise.all([
      blueprints.uxBlueprint
        ? artifactApprovalService.getState(
            ownerUserId,
            projectId,
            "blueprint_ux",
            blueprints.uxBlueprint.id,
          )
        : null,
      blueprints.techBlueprint
        ? artifactApprovalService.getState(
            ownerUserId,
            projectId,
            "blueprint_tech",
            blueprints.techBlueprint.id,
          )
        : null,
    ]);
    const uxApproved = Boolean(uxState?.approval);
    const techApproved = Boolean(techState?.approval);
    const userFlowsPassed = techApproved && Boolean(userFlows.approvedAt);
    const [milestones, features] = await Promise.all([
      userFlowsPassed
        ? milestoneService.list(ownerUserId, projectId)
        : Promise.resolve({
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
      userFlowsPassed
        ? featureService.list(ownerUserId, projectId)
        : Promise.resolve({ features: [] }),
    ]);
    const visibleMilestones = milestones.milestones.filter((milestone) => !milestone.isBootstrapPlaceholder);
    const milestoneCount = visibleMilestones.length;
    const milestoneDocumentCount = userFlowsPassed
      ? await milestoneService.countMilestonesWithCanonicalDesignDocs(ownerUserId, projectId)
      : 0;
    const approvedMilestoneCount = visibleMilestones.filter(
      (milestone) => milestone.status === "approved" || milestone.status === "completed",
    ).length;
    const scopedMilestoneCount = visibleMilestones.filter(
      (milestone) => milestone.scopeReviewStatus === "passed",
    ).length;
    const deliveredMilestoneCount = visibleMilestones.filter(
      (milestone) => milestone.deliveryReviewStatus === "passed",
    ).length;
    const featureCount = features.features.length;
    const featuresWithTasksCount = features.features.filter((feature) => feature.taskPlanning.hasTasks).length;
    const userFlowCount = userFlows.userFlows.length;
    const userFlowCoverageGapCount = userFlows.coverage.warnings.length;

    return {
      phases: [
        {
          phase: "Project Setup",
          passed: setupPassed,
          items: [
            ...setupStatus.checks.map((check) => ({
              key: check.key,
              label: check.label,
              passed: check.status === "pass",
            })),
            {
              key: "setup_completed",
              label: "Setup completed",
              passed: setupCompleted,
            },
          ],
        },
        {
          phase: "Overview Document",
          passed: overviewPassed,
          items: [
            {
              key: "questionnaire",
              label: "Questionnaire complete",
              passed: Boolean(questionnaire.completedAt),
            },
            {
              key: "overview",
              label: "Overview approved",
              passed: overviewPassed,
            },
          ],
        },
        {
          phase: "Product Spec",
          passed: productSpecPassed,
          items: [
            {
              key: "overview_approved",
              label: "Overview approved",
              passed: overviewPassed,
            },
            {
              key: "product_spec",
              label: "Product Spec generated",
              passed: Boolean(productSpec),
            },
            {
              key: "product_spec_approved",
              label: "Product Spec approved",
              passed: Boolean(productSpec?.approvedAt),
            },
          ],
        },
        {
          phase: "UX Spec",
          passed:
            productSpecPassed &&
            uxDecisionGenerated &&
            uxDecisionSelected &&
            uxDecisionAccepted &&
            uxGenerated &&
            uxApproved,
          items: [
            {
              key: "product_spec_approved",
              label: "Product Spec approved",
              passed: productSpecPassed,
            },
            {
              key: "ux_decision_tiles",
              label: "UX decision tiles generated",
              passed: uxDecisionGenerated,
            },
            {
              key: "ux_decision_selections",
              label: "UX decision selections complete",
              passed: uxDecisionSelected,
            },
            {
              key: "ux_decision_acceptance",
              label: "UX decisions accepted",
              passed: uxDecisionAccepted,
            },
            {
              key: "ux_spec_generated",
              label: "UX Spec generated",
              passed: uxGenerated,
            },
            {
              key: "ux_approved",
              label: "UX Spec approved",
              passed: uxApproved,
            },
          ],
        },
        {
          phase: "Technical Spec",
          passed:
            uxApproved &&
            techDecisionGenerated &&
            techDecisionSelected &&
            techDecisionAccepted &&
            techGenerated &&
            techApproved,
          items: [
            {
              key: "ux_approved",
              label: "UX Spec approved",
              passed: uxApproved,
            },
            {
              key: "tech_decision_tiles",
              label: "Technical decision tiles generated",
              passed: techDecisionGenerated,
            },
            {
              key: "tech_decision_selections",
              label: "Technical decision selections complete",
              passed: techDecisionSelected,
            },
            {
              key: "tech_decision_acceptance",
              label: "Technical decisions accepted",
              passed: techDecisionAccepted,
            },
            {
              key: "tech_spec_generated",
              label: "Technical Spec generated",
              passed: techGenerated,
            },
            {
              key: "tech_approved",
              label: "Technical Spec approved",
              passed: techApproved,
            },
          ],
        },
        {
          phase: "User Flows",
          passed: userFlowCount > 0 && userFlowCoverageGapCount === 0,
          items: [
            {
              key: "user_flow_count",
              label: `${userFlowCount} written user flow${userFlowCount === 1 ? "" : "s"}`,
              passed: userFlowCount > 0,
            },
            {
              key: "user_flow_coverage_gaps",
              label: `${userFlowCoverageGapCount} coverage gap${userFlowCoverageGapCount === 1 ? "" : "s"}`,
              passed: userFlowCoverageGapCount === 0,
            },
          ],
        },
        {
          phase: "Milestones",
          passed:
            milestones.mapReview.reviewStatus === "passed" &&
            milestoneCount > 0 &&
            milestoneDocumentCount === milestoneCount &&
            approvedMilestoneCount === milestoneCount &&
            scopedMilestoneCount === milestoneCount &&
            deliveredMilestoneCount === milestoneCount,
          items: [
            {
              key: "milestone_map_review",
              label: "Milestone map review passed",
              passed: milestones.mapReview.reviewStatus === "passed",
            },
            {
              key: "milestone_count",
              label: `${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"}`,
              passed: milestoneCount > 0,
            },
            {
              key: "milestone_document_count",
              label: `${milestoneDocumentCount} milestone document${milestoneDocumentCount === 1 ? "" : "s"}`,
              passed: milestoneCount > 0 && milestoneDocumentCount === milestoneCount,
            },
            {
              key: "milestone_approved_count",
              label: `${approvedMilestoneCount} approved milestone${approvedMilestoneCount === 1 ? "" : "s"}`,
              passed: milestoneCount > 0 && approvedMilestoneCount === milestoneCount,
            },
            {
              key: "milestone_scope_review_count",
              label: `${scopedMilestoneCount} milestone scope review${scopedMilestoneCount === 1 ? "" : "s"}`,
              passed: milestoneCount > 0 && scopedMilestoneCount === milestoneCount,
            },
            {
              key: "milestone_delivery_review_count",
              label: `${deliveredMilestoneCount} milestone delivery review${deliveredMilestoneCount === 1 ? "" : "s"}`,
              passed: milestoneCount > 0 && deliveredMilestoneCount === milestoneCount,
            },
          ],
        },
        {
          phase: "Features",
          passed: featureCount > 0 && featuresWithTasksCount === featureCount,
          items: [
            {
              key: "feature_count",
              label: `${featureCount} feature${featureCount === 1 ? "" : "s"}`,
              passed: featureCount > 0,
            },
            {
              key: "feature_task_count",
              label: `${featuresWithTasksCount} feature${featuresWithTasksCount === 1 ? "" : "s"} with tasks`,
              passed: featureCount > 0 && featuresWithTasksCount === featureCount,
            },
          ],
        },
      ],
    };
  },
});

export type PhaseGateService = ReturnType<typeof createPhaseGateService>;
