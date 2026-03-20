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
    const [
      setupStatus,
      setupCompleted,
      questionnaire,
      onePager,
      productSpec,
      userFlows,
      uxDecisionCards,
      techDecisionCards,
      blueprints,
    ] = await Promise.all([
      projectSetupService.getSetupStatus(ownerUserId, projectId),
      projectSetupService.isSetupCompleted(ownerUserId, projectId),
      questionnaireService.getAnswers(projectId),
      onePagerService.getCanonical(ownerUserId, projectId),
      productSpecService.getCanonical(ownerUserId, projectId),
      userFlowService.list(ownerUserId, projectId),
      blueprintService.listDecisionCards(ownerUserId, projectId, "ux"),
      blueprintService.listDecisionCards(ownerUserId, projectId, "tech"),
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
    } else if (uxDecisionCards.cards.length === 0) {
      actions.push({
        key: "ux_decisions_generate",
        label: "Generate the UX decision tiles",
        href: `/projects/${projectId}/ux-spec`,
      });
    } else if (uxDecisionCards.cards.some((card) => !card.selectedOptionId && !card.customSelection)) {
      actions.push({
        key: "ux_decisions_select",
        label: "Select every UX decision tile",
        href: `/projects/${projectId}/ux-spec`,
      });
    } else if (uxDecisionCards.cards.some((card) => !card.acceptedAt)) {
      actions.push({
        key: "ux_decisions_accept",
        label: "Accept the UX decisions",
        href: `/projects/${projectId}/ux-spec`,
      });
    } else if (!blueprints.uxBlueprint) {
      actions.push({
        key: "ux_spec_generate",
        label: "Generate the UX Spec",
        href: `/projects/${projectId}/ux-spec`,
      });
    } else {
      const uxState = await artifactReviewService.getState(
        ownerUserId,
        projectId,
        "blueprint_ux",
        blueprints.uxBlueprint.id,
      );

      if (!uxState.latestReviewRun || uxState.latestReviewRun.status !== "succeeded") {
        actions.push({
          key: "ux_spec_review",
          label: "Run UX Spec review",
          href: `/projects/${projectId}/ux-spec`,
        });
      } else if (uxState.openBlockerCount > 0) {
        actions.push({
          key: "ux_spec_blockers",
          label: "Resolve UX Spec blockers",
          href: `/projects/${projectId}/ux-spec`,
        });
      } else if (!uxState.approval) {
        actions.push({
          key: "ux_spec_approval",
          label: "Approve the UX Spec",
          href: `/projects/${projectId}/ux-spec`,
        });
      } else if (techDecisionCards.cards.length === 0) {
        actions.push({
          key: "tech_decisions_generate",
          label: "Generate the Technical decision tiles",
          href: `/projects/${projectId}/technical-spec`,
        });
      } else if (
        techDecisionCards.cards.some((card) => !card.selectedOptionId && !card.customSelection)
      ) {
        actions.push({
          key: "tech_decisions_select",
          label: "Select every Technical decision tile",
          href: `/projects/${projectId}/technical-spec`,
        });
      } else if (techDecisionCards.cards.some((card) => !card.acceptedAt)) {
        actions.push({
          key: "tech_decisions_accept",
          label: "Accept the Technical decisions",
          href: `/projects/${projectId}/technical-spec`,
        });
      } else if (!blueprints.techBlueprint) {
        actions.push({
          key: "tech_spec_generate",
          label: "Generate the Technical Spec",
          href: `/projects/${projectId}/technical-spec`,
        });
      } else {
        const techState = await artifactReviewService.getState(
          ownerUserId,
          projectId,
          "blueprint_tech",
          blueprints.techBlueprint.id,
        );

        if (!techState.latestReviewRun || techState.latestReviewRun.status !== "succeeded") {
          actions.push({
            key: "tech_spec_review",
            label: "Run Technical Spec review",
            href: `/projects/${projectId}/technical-spec`,
          });
        } else if (techState.openBlockerCount > 0) {
          actions.push({
            key: "tech_spec_blockers",
            label: "Resolve Technical Spec blockers",
            href: `/projects/${projectId}/technical-spec`,
          });
        } else if (!techState.approval) {
          actions.push({
            key: "tech_spec_approval",
            label: "Approve the Technical Spec",
            href: `/projects/${projectId}/technical-spec`,
          });
        }
      }
    }

    return { actions };
  },
});

export type NextActionsService = ReturnType<typeof createNextActionsService>;
