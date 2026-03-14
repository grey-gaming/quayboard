import type { OnePagerService } from "./one-pager-service.js";
import type { ProjectSetupService } from "./project-setup-service.js";
import type { QuestionnaireService } from "./questionnaire-service.js";
import type { UserFlowService } from "./user-flow-service.js";

export const createPhaseGateService = (
  onePagerService: OnePagerService,
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  userFlowService: UserFlowService,
) => ({
  async build(ownerUserId: string, projectId: string) {
    const [onePager, setupStatus, questionnaire, userFlows] = await Promise.all([
      onePagerService.getCanonical(ownerUserId, projectId),
      projectSetupService.getSetupStatus(ownerUserId, projectId),
      questionnaireService.getAnswers(projectId),
      userFlowService.list(ownerUserId, projectId),
    ]);

    const setupPassed =
      setupStatus.repoConnected && setupStatus.llmVerified && setupStatus.sandboxVerified;
    const overviewPassed = Boolean(onePager?.approvedAt);
    const userFlowsPassed = Boolean(userFlows.approvedAt);

    return {
      phases: [
        {
          phase: "Project Setup",
          passed: setupPassed,
          items: setupStatus.checks.map((check) => ({
            key: check.key,
            label: check.label,
            passed: check.status === "pass",
          })),
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
          phase: "User Flows",
          passed: userFlowsPassed,
          items: [
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
