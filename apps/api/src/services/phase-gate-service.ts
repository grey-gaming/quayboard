import type { OnePagerService } from "./one-pager-service.js";
import type { ProductSpecService } from "./product-spec-service.js";
import type { ProjectSetupService } from "./project-setup-service.js";
import type { QuestionnaireService } from "./questionnaire-service.js";
import type { UserFlowService } from "./user-flow-service.js";

export const createPhaseGateService = (
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  userFlowService: UserFlowService,
) => ({
  async build(ownerUserId: string, projectId: string) {
    const [onePager, productSpec, setupStatus, setupCompleted, questionnaire, userFlows] =
      await Promise.all([
        onePagerService.getCanonical(ownerUserId, projectId),
        productSpecService.getCanonical(ownerUserId, projectId),
        projectSetupService.getSetupStatus(ownerUserId, projectId),
        projectSetupService.isSetupCompleted(ownerUserId, projectId),
        questionnaireService.getAnswers(projectId),
        userFlowService.list(ownerUserId, projectId),
      ]);

    const setupPassed = setupCompleted;
    const overviewPassed = Boolean(onePager?.approvedAt);
    const productSpecPassed = overviewPassed && Boolean(productSpec?.approvedAt);
    const userFlowsPassed = Boolean(userFlows.approvedAt);

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
      ],
    };
  },
});

export type PhaseGateService = ReturnType<typeof createPhaseGateService>;
