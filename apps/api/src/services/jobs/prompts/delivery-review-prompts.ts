import type { ProjectSizeProfile } from "../../project-sizer.js";

import { qualityCharter, renderMilestoneScaffoldingGuidance } from "./shared.js";

export const buildDeliveryReviewPrompt = (input: {
  projectName: string;
  productSpec: string;
  userFlows: Array<{ title: string; userStory: string }>;
  milestones: Array<{ title: string; summary: string; featureCount: number }>;
  coverage: {
    approvedUserFlowCount: number;
    coveredUserFlowCount: number;
    uncoveredUserFlowTitles: string[];
  };
  sizeProfile?: ProjectSizeProfile;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review the planning deliverables for "${input.projectName}" and assess whether they sufficiently satisfy the Product Spec.`,
    'Return valid JSON with exactly two keys: "complete" (boolean) and "issues" (array).',
    'Set "complete" to true only when all checks below pass with no meaningful gaps.',
    "If any gaps are found, set complete to false and list each issue in the issues array.",
    'Each issue must be an object with exactly two string keys: "jobType" and "hint".',
    '"jobType" must be exactly one of: "GenerateUseCases" or "GenerateMilestones".',
    '"hint" must clearly describe what is missing and why, so the generation job can produce only the missing content.',
    "Issues must be ordered by priority: milestone issues first, user flow issues second.",
    "Milestone-to-user-flow coverage is provided as authoritative structured data below.",
    "Do not infer missing milestone coverage from milestone prose when the coverage summary shows all approved user flows are already covered.",
    "Do not wrap the JSON in code fences.",
    "",
    "Checks to perform (evaluate in this order — stop at the first failing check):",
    "1. Milestones — do the milestones provide a coherent, complete delivery plan that covers all approved user flows?",
    "   Because every project in this workflow is greenfield, milestone 1 must be a real foundations/setup milestone.",
    `   ${input.sizeProfile
      ? renderMilestoneScaffoldingGuidance(input.sizeProfile)
      : "The first milestone must cover repository and delivery scaffolding such as AGENTS.md, initial folder structure, baseline docs/ADR scaffolding, environment/bootstrap setup, CI/test harness, and a minimal smoke-path or hello-world slice."}`,
    "   Fail milestone review if milestone 1 does not explicitly establish those named foundation minimums.",
    "   Each user flow should map to at least one milestone. Look for user flows that no milestone addresses.",
    "   Milestones with featureCount > 0 are actively being implemented — treat them as in-progress delivery.",
    "   If any user flows are uncovered by milestones, raise a GenerateMilestones issue (not GenerateUseCases).",
    "2. User Flows — only check this if milestones already cover all current user flows.",
    "   Are there fundamentally important journeys missing from the product spec that are not represented at all?",
    "   Be conservative: only flag a genuine gap (e.g. no onboarding flow exists at all, no error-recovery flow exists at all).",
    "   Do NOT flag minor variations, edge cases, or flows that are implied by existing ones.",
    "   Do NOT flag user flow gaps if the milestone plan does not yet cover the existing flows — fix milestones first.",
    "3. Overall — given the above, is the planning complete enough to begin or continue implementation?",
    "   Prefer returning complete: true when coverage is reasonable. Only return complete: false for clear, actionable gaps.",
    "",
    "Approved Product Spec:",
    input.productSpec,
    "",
    "Approved User Flows:",
    JSON.stringify(input.userFlows, null, 2),
    "",
    "Authoritative milestone coverage summary:",
    JSON.stringify(input.coverage, null, 2),
    "",
    "Approved Milestones (featureCount = number of features already created for that milestone):",
    JSON.stringify(input.milestones, null, 2),
  ].join("\n");
