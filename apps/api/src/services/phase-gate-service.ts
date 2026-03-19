import type { ArtifactReviewService } from "./artifact-review-service.js";
import type { BlueprintService } from "./blueprint-service.js";
import type { OnePagerService } from "./one-pager-service.js";
import type { ProductSpecService } from "./product-spec-service.js";
import type { ProjectSetupService } from "./project-setup-service.js";
import type { QuestionnaireService } from "./questionnaire-service.js";
import type { UserFlowService } from "./user-flow-service.js";

export const createPhaseGateService = (
  artifactReviewService: ArtifactReviewService,
  blueprintService: BlueprintService,
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  userFlowService: UserFlowService,
) => ({
  async build(ownerUserId: string, projectId: string) {
    const [onePager, productSpec, setupStatus, setupCompleted, questionnaire, userFlows, decisionCards, blueprints] =
      await Promise.all([
        onePagerService.getCanonical(ownerUserId, projectId),
        productSpecService.getCanonical(ownerUserId, projectId),
        projectSetupService.getSetupStatus(ownerUserId, projectId),
        projectSetupService.isSetupCompleted(ownerUserId, projectId),
        questionnaireService.getAnswers(projectId),
        userFlowService.list(ownerUserId, projectId),
        blueprintService.listDecisionCards(ownerUserId, projectId),
        blueprintService.getCanonical(ownerUserId, projectId),
      ]);

    const setupPassed = setupCompleted;
    const overviewPassed = Boolean(onePager?.approvedAt);
    const productSpecPassed = overviewPassed && Boolean(productSpec?.approvedAt);
    const userFlowsPassed = Boolean(userFlows.approvedAt);
    const decisionDeckGenerated = decisionCards.cards.length > 0;
    const decisionDeckSelected =
      decisionDeckGenerated &&
      decisionCards.cards.every((card) => card.selectedOptionId || card.customSelection);
    const uxGenerated = Boolean(blueprints.uxBlueprint);
    const techGenerated = Boolean(blueprints.techBlueprint);
    const [uxState, techState] = await Promise.all([
      blueprints.uxBlueprint
        ? artifactReviewService.getState(
            ownerUserId,
            projectId,
            "blueprint_ux",
            blueprints.uxBlueprint.id,
          )
        : null,
      blueprints.techBlueprint
        ? artifactReviewService.getState(
            ownerUserId,
            projectId,
            "blueprint_tech",
            blueprints.techBlueprint.id,
          )
        : null,
    ]);
    const uxBlockersResolved = uxGenerated && (uxState?.openBlockerCount ?? 0) === 0;
    const techBlockersResolved = techGenerated && (techState?.openBlockerCount ?? 0) === 0;
    const uxApproved = Boolean(uxState?.approval);
    const techApproved = Boolean(techState?.approval);

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
          phase: "User Flows",
          passed: productSpecPassed && userFlowsPassed,
          items: [
            {
              key: "product_spec_approved",
              label: "Product Spec approved",
              passed: productSpecPassed,
            },
            {
              key: "flows_exist",
              label: "At least one active user flow",
              passed: userFlows.userFlows.length > 0,
            },
            {
              key: "flows_approved",
              label: "User flows approved",
              passed: userFlowsPassed,
            },
          ],
        },
        {
          phase: "Blueprint",
          passed:
            userFlowsPassed &&
            decisionDeckGenerated &&
            decisionDeckSelected &&
            uxGenerated &&
            techGenerated &&
            uxBlockersResolved &&
            techBlockersResolved &&
            uxApproved &&
            techApproved,
          items: [
            {
              key: "user_flows_approved",
              label: "User flows approved",
              passed: userFlowsPassed,
            },
            {
              key: "decision_deck",
              label: "Decision deck generated",
              passed: decisionDeckGenerated,
            },
            {
              key: "decision_selections",
              label: "Decision selections complete",
              passed: decisionDeckSelected,
            },
            {
              key: "ux_blueprint",
              label: "UX blueprint generated",
              passed: uxGenerated,
            },
            {
              key: "tech_blueprint",
              label: "Tech blueprint generated",
              passed: techGenerated,
            },
            {
              key: "ux_blockers",
              label: "UX blueprint blockers resolved",
              passed: uxBlockersResolved,
            },
            {
              key: "tech_blockers",
              label: "Tech blueprint blockers resolved",
              passed: techBlockersResolved,
            },
            {
              key: "ux_approved",
              label: "UX blueprint approved",
              passed: uxApproved,
            },
            {
              key: "tech_approved",
              label: "Tech blueprint approved",
              passed: techApproved,
            },
          ],
        },
      ],
    };
  },
});

export type PhaseGateService = ReturnType<typeof createPhaseGateService>;
