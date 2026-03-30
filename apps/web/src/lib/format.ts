const STEP_KEY_ABBR: Record<string, string> = { ux: "UX", tech: "Tech" };

const STEP_KEY_LABELS: Record<string, string> = {
  questionnaire: "Complete Questionnaire",
  overview: "Generate Overview",
  overview_approval: "Approve Overview",
  product_spec: "Generate Product Spec",
  product_spec_approval: "Approve Product Spec",
  ux_decisions_generate: "Generate UX Decisions",
  ux_decisions_select: "Select UX Decisions",
  ux_decisions_accept: "Accept UX Decisions",
  ux_spec_generate: "Generate UX Spec",
  ux_spec_approval: "Approve UX Spec",
  tech_decisions_generate: "Generate Tech Decisions",
  tech_decisions_select: "Select Tech Decisions",
  tech_decisions_accept: "Accept Tech Decisions",
  tech_spec_generate: "Generate Tech Spec",
  tech_spec_approval: "Approve Tech Spec",
  user_flows_generate: "Generate User Flows",
  user_flows_approve: "Approve User Flows",
  milestones_generate: "Generate Milestones",
  milestone_map_review: "Run Milestone Map Review",
  milestone_map_resolve: "Resolve Milestone Map Issues",
  milestone_design_generate: "Generate Milestone Design",
  milestones_approve: "Approve Milestone",
  milestone_scope_review: "Run Milestone Scope Review",
  milestone_scope_resolve: "Resolve Milestone Scope Issues",
  milestone_delivery_review: "Run Milestone Delivery Review",
  milestone_delivery_resolve: "Resolve Milestone Delivery Issues",
  milestone_complete: "Complete Milestone",
  features_create: "Generate Milestone Feature Set",
  feature_product_create: "Generate Feature Spec",
  feature_product_approval: "Approve Feature Spec",
  feature_task_clarifications_generate: "Generate Task Clarifications",
  feature_task_clarifications_answer: "Answer Task Clarifications",
  feature_task_list_generate: "Generate Task List",
  feature_stale_implementation: "Re-implement Feature",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  AppendFeatureFromOnePager: "Generate Milestone Feature Set",
  GenerateMilestoneFeatureSet: "Generate Milestone Feature Set",
  ReviewMilestoneMap: "Review Milestone Map",
  RewriteMilestoneMap: "Rewrite Milestone Map",
  ReviewMilestoneScope: "Review Milestone Scope",
  ReviewMilestoneDelivery: "Review Milestone Delivery",
  ResolveMilestoneDeliveryIssues: "Resolve Milestone Delivery Issues",
  GenerateMilestoneCatchUpFeature: "Rewrite Milestone Feature Set",
  RewriteMilestoneFeatureSet: "Rewrite Milestone Feature Set",
};

export const formatStepKey = (key: string): string =>
  STEP_KEY_LABELS[key] ??
  key
    .split("_")
    .map((word) => STEP_KEY_ABBR[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatJobType = (type: string): string =>
  JOB_TYPE_LABELS[type] ?? type.replace(/([A-Z])/g, " $1").trim();

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};
