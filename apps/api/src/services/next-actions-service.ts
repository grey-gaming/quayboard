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
import type { TaskPlanningService } from "./task-planning-service.js";

export const createNextActionsService = (
  artifactApprovalService: ArtifactApprovalService,
  blueprintService: BlueprintService,
  featureService: FeatureService,
  featureWorkstreamService: FeatureWorkstreamService,
  milestoneService: MilestoneService,
  projectSetupService: ProjectSetupService,
  questionnaireService: QuestionnaireService,
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  userFlowService: UserFlowService,
  taskPlanningService?: TaskPlanningService,
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
      const uxState = await artifactApprovalService.getState(
        ownerUserId,
        projectId,
        "blueprint_ux",
        blueprints.uxBlueprint.id,
      );

      if (!uxState.approval) {
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
        const techState = await artifactApprovalService.getState(
          ownerUserId,
          projectId,
          "blueprint_tech",
          blueprints.techBlueprint.id,
        );

        if (!techState.approval) {
          actions.push({
            key: "tech_spec_approval",
            label: "Approve the Technical Spec",
            href: `/projects/${projectId}/technical-spec`,
          });
        } else if (!userFlows.approvedAt) {
          actions.push({
            key: "user_flows",
            label: "Generate and approve user flows",
            href: `/projects/${projectId}/user-flows`,
          });
        } else {
          const [milestones, features] = await Promise.all([
            milestoneService.list(ownerUserId, projectId),
            featureService.list(ownerUserId, projectId),
          ]);
          const hasApprovedMilestone = milestones.milestones.some(
            (milestone) => milestone.status === "approved",
          );

          if (milestones.milestones.length === 0) {
            actions.push({
              key: "milestones_generate",
              label: "Create or generate milestones",
              href: `/projects/${projectId}/milestones`,
            });
          } else if (!hasApprovedMilestone) {
            actions.push({
              key: "milestones_approve",
              label: "Approve a milestone",
              href: `/projects/${projectId}/milestones`,
            });
          } else if (features.features.length === 0) {
            actions.push({
              key: "features_create",
              label: "Create the first feature",
              href: `/projects/${projectId}/features`,
            });
          } else {
            const orderedFeatures = [...features.features].sort((left, right) =>
              left.featureKey.localeCompare(right.featureKey),
            );
            let nextFeature = orderedFeatures[0] ?? null;
            let needsApproval = false;

            for (const feature of orderedFeatures) {
              const tracks = await featureWorkstreamService.getTracks(ownerUserId, feature.id);
              if (!tracks.tracks.product.headRevision) {
                nextFeature = feature;
                needsApproval = false;
                break;
              }

              if (tracks.tracks.product.status !== "approved") {
                nextFeature = feature;
                needsApproval = true;
                break;
              }
            }

            if (nextFeature) {
              actions.push({
                key: needsApproval ? "feature_product_approval" : "feature_product_create",
                label: needsApproval
                  ? "Approve a feature Product Spec"
                  : "Author the first feature Product Spec",
                href: `/projects/${projectId}/features/${nextFeature.id}`,
              });
            } else if (taskPlanningService) {
              // All features have approved product specs — check for stale implementations.
              // A feature is stale when its implementation record references a tech revision
              // that is not the current head revision for that feature.
              for (const feature of orderedFeatures) {
                const tracks = await featureWorkstreamService.getTracks(ownerUserId, feature.id);
                const headTechRevisionId = tracks.tracks.tech.headRevision?.id ?? null;

                if (!headTechRevisionId) {
                  continue;
                }

                const records = await taskPlanningService.getImplementationRecords(
                  ownerUserId,
                  feature.id,
                );
                const latestRecord = records[0] ?? null;

                if (latestRecord && latestRecord.techRevisionId !== headTechRevisionId) {
                  actions.push({
                    key: "feature_stale_implementation",
                    label: `Re-implement stale feature: ${feature.headRevision.title}`,
                    href: `/projects/${projectId}/features/${feature.id}`,
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }

    return { actions };
  },
});

export type NextActionsService = ReturnType<typeof createNextActionsService>;
