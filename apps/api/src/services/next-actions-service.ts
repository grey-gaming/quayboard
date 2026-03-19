import type { ArtifactReviewService } from "./artifact-review-service.js";
import type { BlueprintService } from "./blueprint-service.js";
import type { OnePagerService } from "./one-pager-service.js";
import type { ProductSpecService } from "./product-spec-service.js";
import type { ProjectSetupService } from "./project-setup-service.js";
import type { QuestionnaireService } from "./questionnaire-service.js";
import type { UserFlowService } from "./user-flow-service.js";

export const createNextActionsService = (
  artifactReviewService: ArtifactReviewService,
  blueprintService: BlueprintService,
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  userFlowService: UserFlowService,
) => ({
  async build(ownerUserId: string, projectId: string) {
    const [setupStatus, setupCompleted, questionnaire, onePager, productSpec, userFlows, decisionCards, blueprints] =
      await Promise.all([
        projectSetupService.getSetupStatus(ownerUserId, projectId),
        projectSetupService.isSetupCompleted(ownerUserId, projectId),
        questionnaireService.getAnswers(projectId),
        onePagerService.getCanonical(ownerUserId, projectId),
        productSpecService.getCanonical(ownerUserId, projectId),
        userFlowService.list(ownerUserId, projectId),
        blueprintService.listDecisionCards(ownerUserId, projectId),
        blueprintService.getCanonical(ownerUserId, projectId),
      ]);
    const actions = [];

    if (!setupCompleted) {
      const setupChecksPassed =
        setupStatus.repoConnected && setupStatus.llmVerified && setupStatus.sandboxVerified;

      actions.push({
        key: "project_setup",
        label: setupChecksPassed ? "Complete project setup" : "Finish project setup",
        href: `/projects/${projectId}/setup`,
      });
    } else if (!questionnaire.completedAt) {
      actions.push({
        key: "questionnaire",
        label: "Complete the questionnaire",
        href: `/projects/${projectId}/questions`,
      });
    } else if (!onePager) {
      actions.push({
        key: "overview",
        label: "Generate the overview document",
        href: `/projects/${projectId}/one-pager`,
      });
    } else if (!onePager.approvedAt) {
      actions.push({
        key: "overview_approval",
        label: "Approve the overview document",
        href: `/projects/${projectId}/one-pager`,
      });
    } else if (!productSpec) {
      actions.push({
        key: "product_spec",
        label: "Generate the Product Spec",
        href: `/projects/${projectId}/product-spec`,
      });
    } else if (!productSpec.approvedAt) {
      actions.push({
        key: "product_spec_approval",
        label: "Approve the Product Spec",
        href: `/projects/${projectId}/product-spec`,
      });
    } else if (!userFlows.approvedAt) {
      actions.push({
        key: "user_flows",
        label: "Generate and approve user flows",
        href: `/projects/${projectId}/user-flows`,
      });
    } else if (decisionCards.cards.length === 0) {
      actions.push({
        key: "blueprint_deck",
        label: "Generate the decision deck",
        href: `/projects/${projectId}/blueprint`,
      });
    } else if (decisionCards.cards.some((card) => !card.selectedOptionId && !card.customSelection)) {
      actions.push({
        key: "blueprint_decisions",
        label: "Select every decision card",
        href: `/projects/${projectId}/blueprint`,
      });
    } else if (!blueprints.uxBlueprint) {
      actions.push({
        key: "blueprint_ux",
        label: "Generate the UX blueprint",
        href: `/projects/${projectId}/blueprint`,
      });
    } else if (!blueprints.techBlueprint) {
      actions.push({
        key: "blueprint_tech",
        label: "Generate the tech blueprint",
        href: `/projects/${projectId}/blueprint`,
      });
    } else {
      const [uxState, techState] = await Promise.all([
        artifactReviewService.getState(
          ownerUserId,
          projectId,
          "blueprint_ux",
          blueprints.uxBlueprint.id,
        ),
        artifactReviewService.getState(
          ownerUserId,
          projectId,
          "blueprint_tech",
          blueprints.techBlueprint.id,
        ),
      ]);

      if (!uxState.latestReviewRun || uxState.latestReviewRun.status !== "succeeded") {
        actions.push({
          key: "blueprint_ux_review",
          label: "Run UX blueprint review",
          href: `/projects/${projectId}/blueprint`,
        });
      } else if (uxState.openBlockerCount > 0) {
        actions.push({
          key: "blueprint_ux_blockers",
          label: "Resolve UX blueprint blockers",
          href: `/projects/${projectId}/blueprint`,
        });
      } else if (!uxState.approval) {
        actions.push({
          key: "blueprint_ux_approval",
          label: "Approve the UX blueprint",
          href: `/projects/${projectId}/blueprint`,
        });
      } else if (!techState.latestReviewRun || techState.latestReviewRun.status !== "succeeded") {
        actions.push({
          key: "blueprint_tech_review",
          label: "Run tech blueprint review",
          href: `/projects/${projectId}/blueprint`,
        });
      } else if (techState.openBlockerCount > 0) {
        actions.push({
          key: "blueprint_tech_blockers",
          label: "Resolve tech blueprint blockers",
          href: `/projects/${projectId}/blueprint`,
        });
      } else if (!techState.approval) {
        actions.push({
          key: "blueprint_tech_approval",
          label: "Approve the tech blueprint",
          href: `/projects/${projectId}/blueprint`,
        });
      }
    }

    return { actions };
  },
});

export type NextActionsService = ReturnType<typeof createNextActionsService>;
