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
import { isTaskPlanningReady } from "./task-planning-support.js";

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
        } else if (userFlows.userFlows.length === 0) {
          actions.push({
            key: "user_flows_generate",
            label: "Generate user flows",
            href: `/projects/${projectId}/user-flows`,
          });
        } else if (!userFlows.approvedAt) {
          actions.push({
            key: "user_flows_approve",
            label: "Approve user flows",
            href: `/projects/${projectId}/user-flows`,
          });
        } else {
          const [milestones, features] = await Promise.all([
            milestoneService.list(ownerUserId, projectId),
            featureService.list(ownerUserId, projectId),
          ]);
          const activeMilestone =
            milestones.milestones.find((milestone) => milestone.isActive) ?? null;
          const mapReview = milestones.mapReview ?? {
            generatedAt: milestones.milestones.length > 0 ? new Date().toISOString() : null,
            reviewStatus: milestones.milestones.length > 0 ? "passed" : "not_started",
            reviewIssues: [],
            reviewedAt: null,
          };
          const useLegacyMilestoneReviewKeys = !("mapReview" in milestones);
          const hasGeneratedMap = Boolean(mapReview.generatedAt);
          const mapReviewStatus = mapReview.reviewStatus;

          if (!hasGeneratedMap) {
            actions.push({
              key: "milestones_generate",
              label: "Generate milestones",
              href: `/projects/${projectId}/milestones`,
            });
          } else if (mapReviewStatus !== "passed" && mapReview.reviewIssues.length > 0) {
            actions.push({
              key: "milestone_map_resolve",
              label: "Resolve milestone map issues",
              description:
                mapReview.reviewIssues[0]?.hint ??
                "Review the milestone map boundaries and rerun the milestone map review.",
              href: `/projects/${projectId}/milestones`,
            });
          } else if (mapReviewStatus !== "passed") {
            actions.push({
              key: "milestone_map_review",
              label: "Run milestone map review",
              href: `/projects/${projectId}/milestones`,
            });
          } else if (!activeMilestone) {
            // All milestones completed.
          } else if (activeMilestone.status === "draft") {
            const designDoc = await milestoneService.getCanonicalDesignDoc(
              ownerUserId,
              activeMilestone.id,
            );
            if (!designDoc) {
              actions.push({
                key: "milestone_design_generate",
                label: "Generate milestone design document",
                href: `/projects/${projectId}/milestones/${activeMilestone.id}`,
              });
            } else {
              actions.push({
                key: "milestones_approve",
                label: "Approve the active milestone",
                href: `/projects/${projectId}/milestones`,
              });
            }
          } else if (activeMilestone.status === "approved") {
            const milestoneFeatures = features.features
              .filter((feature) => feature.milestoneId === activeMilestone.id)
              .sort((left, right) => left.featureKey.localeCompare(right.featureKey));

            if (milestoneFeatures.length === 0) {
              actions.push({
                key: "features_create",
                label: "Generate milestone feature set",
                href: `/projects/${projectId}/features?milestone=${activeMilestone.id}`,
              });
            } else if (
              ((activeMilestone.scopeReviewStatus ??
                (activeMilestone as typeof activeMilestone & { reconciliationStatus?: typeof activeMilestone.scopeReviewStatus })
                  .reconciliationStatus) !== "passed") &&
              ((activeMilestone.scopeReviewIssues ??
                (activeMilestone as typeof activeMilestone & { reconciliationIssues?: typeof activeMilestone.scopeReviewIssues })
                  .reconciliationIssues) ?? []).length > 0
            ) {
              actions.push({
                key: useLegacyMilestoneReviewKeys
                  ? "milestone_reconciliation_resolve"
                  : "milestone_scope_resolve",
                label: useLegacyMilestoneReviewKeys
                  ? "Resolve milestone coverage gaps"
                  : "Resolve milestone scope issues",
                description:
                  (activeMilestone.scopeReviewIssues ??
                    (activeMilestone as typeof activeMilestone & { reconciliationIssues?: typeof activeMilestone.scopeReviewIssues })
                      .reconciliationIssues)?.[0]?.hint ??
                  "Review the active milestone design doc and update the feature set before rerunning review.",
                href: `/projects/${projectId}/milestones`,
              });
            } else if (
              (activeMilestone.scopeReviewStatus ??
                (activeMilestone as typeof activeMilestone & { reconciliationStatus?: typeof activeMilestone.scopeReviewStatus })
                  .reconciliationStatus) !== "passed"
            ) {
              actions.push({
                key: useLegacyMilestoneReviewKeys
                  ? "milestone_reconciliation_review"
                  : "milestone_scope_review",
                label: useLegacyMilestoneReviewKeys
                  ? "Run milestone reconciliation"
                  : "Run milestone scope review",
                href: `/projects/${projectId}/milestones/${activeMilestone.id}`,
              });
            } else {
              // Scope review passed — proceed with feature spec work.
              const allTracks = await Promise.all(
                milestoneFeatures.map((f) => featureWorkstreamService.getTracks(ownerUserId, f.id)),
              );

              let productPhaseFeature: (typeof milestoneFeatures)[number] | null = null;
              let productNeedsApproval = false;

              for (let i = 0; i < milestoneFeatures.length; i++) {
                const tracks = allTracks[i]!;
                if (!tracks.tracks.product.headRevision) {
                  productPhaseFeature = milestoneFeatures[i]!;
                  productNeedsApproval = false;
                  break;
                }
                if (tracks.tracks.product.status !== "approved") {
                  productPhaseFeature = milestoneFeatures[i]!;
                  productNeedsApproval = true;
                  break;
                }
              }

              if (productPhaseFeature) {
                actions.push({
                  key: productNeedsApproval ? "feature_product_approval" : "feature_product_create",
                  label: productNeedsApproval
                    ? "Approve a feature Product Spec"
                    : "Author the first feature Product Spec",
                  href: `/projects/${projectId}/features/${productPhaseFeature.id}`,
                });
              } else {
                const workstreamPhases = [
                  { track: "ux" as const, createKey: "feature_ux_create", approvalKey: "feature_ux_approval", createLabel: "Generate UX spec for feature", approvalLabel: "Approve UX spec for feature" },
                  { track: "tech" as const, createKey: "feature_tech_create", approvalKey: "feature_tech_approval", createLabel: "Generate technical spec for feature", approvalLabel: "Approve technical spec for feature" },
                  { track: "userDocs" as const, createKey: "feature_user_docs_create", approvalKey: "feature_user_docs_approval", createLabel: "Generate user docs for feature", approvalLabel: "Approve user docs for feature" },
                  { track: "archDocs" as const, createKey: "feature_arch_docs_create", approvalKey: "feature_arch_docs_approval", createLabel: "Generate architecture docs for feature", approvalLabel: "Approve architecture docs for feature" },
                ];

                for (let i = 0; i < milestoneFeatures.length; i++) {
                  const feature = milestoneFeatures[i]!;
                  const featureTracks = allTracks[i]!.tracks;

                  for (const phase of workstreamPhases) {
                    const trackData = featureTracks[phase.track];
                    if (!trackData.required) continue;

                    if (
                      phase.track === "archDocs" &&
                      featureTracks.tech.required &&
                      featureTracks.tech.status !== "approved"
                    ) {
                      continue;
                    }

                    if (!trackData.headRevision) {
                      actions.push({
                        key: phase.createKey,
                        label: phase.createLabel,
                        href: `/projects/${projectId}/features/${feature.id}`,
                      });
                      break;
                    }
                    if (trackData.status !== "approved") {
                      actions.push({
                        key: phase.approvalKey,
                        label: phase.approvalLabel,
                        href: `/projects/${projectId}/features/${feature.id}`,
                      });
                      break;
                    }
                  }

                  if (actions.length > 0) {
                    break;
                  }
                }

                if (!actions.length && taskPlanningService) {
                  for (let i = 0; i < milestoneFeatures.length; i++) {
                    const feature = milestoneFeatures[i]!;
                    const featureTracks = allTracks[i]!.tracks;

                    if (!isTaskPlanningReady(featureTracks)) {
                      continue;
                    }

                    const session = await taskPlanningService.getSession(ownerUserId, feature.id);

                    if (!session) {
                      actions.push({
                        key: "feature_task_clarifications_generate",
                        label: "Generate task clarifications",
                        href: `/projects/${projectId}/features/${feature.id}?taskSession=missing`,
                      });
                      break;
                    }

                    if (session.status === "pending_clarifications") {
                      actions.push({
                        key: "feature_task_clarifications_generate",
                        label: "Generate task clarifications",
                        href: `/projects/${projectId}/features/${feature.id}?taskSession=${session.id}`,
                      });
                      break;
                    }

                    if (session.status === "clarifications_generated") {
                      actions.push({
                        key: "feature_task_clarifications_answer",
                        label: "Answer task clarifications",
                        href: `/projects/${projectId}/features/${feature.id}?taskSession=${session.id}`,
                      });
                      break;
                    }

                    if (session.status === "clarifications_answered") {
                      actions.push({
                        key: "feature_task_list_generate",
                        label: "Generate delivery task list",
                        href: `/projects/${projectId}/features/${feature.id}?taskSession=${session.id}`,
                      });
                      break;
                    }
                  }
                }

                if (!actions.length && taskPlanningService) {
                  for (let i = 0; i < milestoneFeatures.length; i++) {
                    const feature = milestoneFeatures[i]!;
                    const headTechRevisionId = allTracks[i]!.tracks.tech.headRevision?.id ?? null;

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

              if (!actions.length) {
                if (
                  activeMilestone.deliveryReviewStatus !== "passed" &&
                  activeMilestone.deliveryReviewIssues.length > 0
                ) {
                  actions.push({
                    key: "milestone_delivery_resolve",
                    label: "Resolve milestone delivery issues",
                    description:
                      activeMilestone.deliveryReviewIssues[0]?.hint ??
                      "Refresh the approved workstreams and tasks before rerunning delivery review.",
                    href: `/projects/${projectId}/milestones`,
                  });
                } else if (activeMilestone.deliveryReviewStatus !== "passed") {
                  actions.push({
                    key: "milestone_delivery_review",
                    label: "Run milestone delivery review",
                    href: `/projects/${projectId}/milestones/${activeMilestone.id}`,
                  });
                } else {
                  actions.push({
                    key: "milestone_complete",
                    label: "Complete the active milestone",
                    href: `/projects/${projectId}/milestones`,
                  });
                }
              }
            }
          } else {
            // Defensive fallback if an unexpected milestone state is introduced.
            actions.push({
              key: "milestones_generate",
              label: "Review milestone plan",
              href: `/projects/${projectId}/milestones`,
            });
          }
        }
      }
    }

    return { actions };
  },

  /**
   * Like build(), but for the feature workstream phase returns up to maxConcurrent
   * parallel create-actions (same track, different features). All planning phases
   * and human-gate steps return a single action as normal.
   */
  async buildBatch(ownerUserId: string, projectId: string, maxConcurrent: number) {
    const { actions } = await this.build(ownerUserId, projectId);
    const firstAction = actions[0] ?? null;

    if (!firstAction) {
      return { actions: [] };
    }

    const parallelCreateKeys = {
      feature_product_create: null,
      feature_ux_create: "ux" as const,
      feature_tech_create: "tech" as const,
      feature_user_docs_create: "userDocs" as const,
      feature_arch_docs_create: "archDocs" as const,
    };

    // If the next action is not a parallelizable feature-create, return it as-is.
    if (!(firstAction.key in parallelCreateKeys) || maxConcurrent <= 1) {
      return { actions: [firstAction] };
    }

    // Collect all features that need the same create action.
    const milestones = await milestoneService.list(ownerUserId, projectId);
    const activeMilestone = milestones.milestones.find((milestone) => milestone.isActive) ?? null;
    const features = await featureService.list(ownerUserId, projectId);
    const orderedFeatures = features.features
      .filter((feature) => !activeMilestone || feature.milestoneId === activeMilestone.id)
      .sort((left, right) =>
      left.featureKey.localeCompare(right.featureKey),
    );
    const allTracks = await Promise.all(
      orderedFeatures.map((f) => featureWorkstreamService.getTracks(ownerUserId, f.id)),
    );

    const batch: typeof actions = [];
    const trackKey = parallelCreateKeys[firstAction.key as keyof typeof parallelCreateKeys];

    if (trackKey === null) {
      // feature_product_create
      for (let i = 0; i < orderedFeatures.length; i++) {
        if (batch.length >= maxConcurrent) break;
        const feature = orderedFeatures[i]!;
        if (!allTracks[i]!.tracks.product.headRevision) {
          batch.push({
            key: "feature_product_create",
            label: "Author the first feature Product Spec",
            href: `/projects/${projectId}/features/${feature.id}`,
            description: firstAction.description,
          });
        }
      }
    } else {
      // Secondary workstream (ux / tech / userDocs / archDocs)
      for (let i = 0; i < orderedFeatures.length; i++) {
        if (batch.length >= maxConcurrent) break;
        const feature = orderedFeatures[i]!;
        const tracks = allTracks[i]!.tracks;
        const trackData = tracks[trackKey];
        if (trackData.required && !trackData.headRevision) {
          // arch_docs requires an approved tech spec when tech is required — skip features that aren't ready yet.
          if (trackKey === "archDocs" && tracks.tech.required && tracks.tech.status !== "approved") {
            continue;
          }
          batch.push({
            key: firstAction.key,
            label: firstAction.label,
            href: `/projects/${projectId}/features/${feature.id}`,
            description: firstAction.description,
          });
        }
      }
    }

    return { actions: batch.length > 0 ? batch : [firstAction] };
  },
});

export type NextActionsService = ReturnType<typeof createNextActionsService>;
