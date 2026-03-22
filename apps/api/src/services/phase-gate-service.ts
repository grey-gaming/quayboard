import type { ArtifactApprovalService } from "./artifact-approval-service.js";
import type { BlueprintService } from "./blueprint-service.js";
import type { FeatureService } from "./feature-service.js";
import type { FeatureWorkstreamService } from "./feature-workstream-service.js";
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
  featureWorkstreamService: FeatureWorkstreamService,
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
        : Promise.resolve({ milestones: [], coverage: { approvedUserFlowCount: 0, coveredUserFlowCount: 0, uncoveredUserFlowIds: [] } }),
      userFlowsPassed
        ? featureService.list(ownerUserId, projectId)
        : Promise.resolve({ features: [] }),
    ]);
    const hasApprovedMilestone = milestones.milestones.some((milestone) => milestone.status === "approved");
    const hasFeatures = features.features.length > 0;
    const approvedFeatureProductCount = userFlowsPassed
      ? (
          await Promise.all(
            features.features.map(async (feature) => {
              const tracks = await featureWorkstreamService.getTracks(ownerUserId, feature.id);
              return tracks.tracks.product.status === "approved";
            }),
          )
        ).filter(Boolean).length
      : 0;

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
          passed: techApproved && userFlowsPassed,
          items: [
            {
              key: "technical_spec_approved",
              label: "Technical Spec approved",
              passed: techApproved,
            },
            {
              key: "flows_exist",
              label: "At least one active user flow",
              passed: userFlows.userFlows.length > 0,
            },
            {
              key: "flows_approved",
              label: "User flows approved",
              passed: Boolean(userFlows.approvedAt),
            },
          ],
        },
        {
          phase: "Milestones",
          passed: userFlowsPassed && hasApprovedMilestone,
          items: [
            {
              key: "user_flows_approved",
              label: "User flows approved",
              passed: userFlowsPassed,
            },
            {
              key: "milestones_exist",
              label: "At least one milestone exists",
              passed: milestones.milestones.length > 0,
            },
            {
              key: "milestone_approved",
              label: "At least one milestone approved",
              passed: hasApprovedMilestone,
            },
          ],
        },
        {
          phase: "Features",
          passed: hasApprovedMilestone && approvedFeatureProductCount > 0,
          items: [
            {
              key: "milestone_approved",
              label: "At least one milestone approved",
              passed: hasApprovedMilestone,
            },
            {
              key: "features_exist",
              label: "At least one active feature exists",
              passed: hasFeatures,
            },
            {
              key: "feature_product_approved",
              label: "At least one feature has an approved Product Spec",
              passed: approvedFeatureProductCount > 0,
            },
          ],
        },
      ],
    };
  },
});

export type PhaseGateService = ReturnType<typeof createPhaseGateService>;
