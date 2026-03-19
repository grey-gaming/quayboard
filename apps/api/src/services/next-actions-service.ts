import type { OnePagerService } from "./one-pager-service.js";
import type { ProductSpecService } from "./product-spec-service.js";
import type { ProjectSetupService } from "./project-setup-service.js";
import type { QuestionnaireService } from "./questionnaire-service.js";
import type { UserFlowService } from "./user-flow-service.js";

export const createNextActionsService = (
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  userFlowService: UserFlowService,
) => ({
  async build(ownerUserId: string, projectId: string) {
    const [setupStatus, setupCompleted, questionnaire, onePager, productSpec, userFlows] =
      await Promise.all([
        projectSetupService.getSetupStatus(ownerUserId, projectId),
        projectSetupService.isSetupCompleted(ownerUserId, projectId),
        questionnaireService.getAnswers(projectId),
        onePagerService.getCanonical(ownerUserId, projectId),
        productSpecService.getCanonical(ownerUserId, projectId),
        userFlowService.list(ownerUserId, projectId),
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
    }

    return { actions };
  },
});

export type NextActionsService = ReturnType<typeof createNextActionsService>;
