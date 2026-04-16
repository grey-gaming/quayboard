import type { ProjectSizeProfile } from "../../project-sizer.js";

import { qualityCharter, renderFeatureBudgetGuidance, renderMilestoneScaffoldingGuidance } from "./shared.js";

export type MilestoneDesignSemanticFeedback = {
  issues: string[];
  repairHint: string;
};

const renderMilestoneDesignSemanticFeedback = (
  feedback: MilestoneDesignSemanticFeedback[] | undefined,
) => {
  const normalized = (feedback ?? [])
    .map((item) => ({
      issues: item.issues.map((issue) => issue.trim()).filter(Boolean),
      repairHint: item.repairHint.trim(),
    }))
    .filter((item) => item.issues.length > 0 || item.repairHint.length > 0);

  if (normalized.length === 0) {
    return [];
  }

  return [
    "",
    "Blocking semantic repair checklist:",
    "Treat every issue and repair hint below as hard non-regression criteria for this milestone design.",
    "If this checklist conflicts with older source text because a reviewer chose a conservative or platform-safe default, this checklist wins for this draft.",
    "Apply the same resolved interpretation consistently across objective, included user flows, scope boundaries, delivery groups, sequencing, and exit criteria.",
    JSON.stringify(normalized, null, 2),
  ];
};

export const buildMilestonePlanPrompt = (input: {
  projectName: string;
  uxSpec: string;
  technicalSpec: string;
  userFlows: Array<{
    id: string;
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  sizeProfile?: ProjectSizeProfile;
  hint?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Propose an initial milestone plan for "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each array item must be an object with exactly these keys: title, summary, useCaseIds.",
    "title must be short and specific.",
    "summary must describe what users can do by the end of this milestone — which flows are live and functional, what end-to-end journeys users can complete, and where the product's current capability boundary ends.",
    "useCaseIds declares which approved user flows this milestone makes functional end-to-end. Use the flow IDs exactly as provided.",
    "The first foundations/setup milestone may use an empty useCaseIds array when it only contains cross-cutting project setup work.",
    "Every milestone after the first must use a non-empty useCaseIds array.",
    "Do not repeat the same user flow in multiple milestones unless the overlap is necessary.",
    "Create milestones in execution order, from foundational work to higher-level capability.",
    "This product flow is always greenfield. The first milestone must be a foundations/setup milestone.",
    "Before outputting, verify that every approved user flow ID appears in exactly one milestone's useCaseIds array. If any flow is unassigned, add it to the most appropriate milestone before outputting.",
    input.sizeProfile
      ? renderMilestoneScaffoldingGuidance(input.sizeProfile)
      : "The first milestone must cover repository and delivery scaffolding such as AGENTS.md, initial folder structure, baseline docs/ADR scaffolding, environment/bootstrap setup, CI/test harness, and a minimal smoke-path or hello-world slice.",
    "Do not wrap the JSON in code fences.",
    ...(input.hint
      ? [
          "",
          "## Guidance",
          "Treat this guidance as hard repair criteria. If it names missing first-milestone foundation items, rewrite milestone 1's summary to explicitly include those items while preserving complete approved user-flow coverage.",
          input.hint,
        ]
      : []),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
    "",
    "Approved user flows:",
    JSON.stringify(input.userFlows, null, 2),
  ].join("\n");

export const buildAppendMilestonePlanPrompt = (input: {
  projectName: string;
  uxSpec: string;
  technicalSpec: string;
  existingMilestones: Array<{
    title: string;
    summary: string;
    featureCount: number;
  }>;
  uncoveredUserFlows: Array<{
    id: string;
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  hint?: string;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Append follow-up milestones for the uncovered user flows in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each array item must be an object with exactly these keys: title, summary, useCaseIds.",
    "title must be short and specific.",
    "summary must describe what users can do by the end of this appended milestone — which flows are live and functional, what end-to-end journeys users can complete, and where the product's current capability boundary ends.",
    "useCaseIds declares which approved user flows this milestone makes functional end-to-end. Use the flow IDs exactly as provided.",
    "Generate only new follow-up milestones. Do not rewrite, rename, or reorder the existing milestones.",
    "Every uncovered user flow must appear exactly once across the appended milestones.",
    "Keep the appended milestones coherent and appendable after the existing implemented milestones.",
    "Do not wrap the JSON in code fences.",
    ...(input.hint
      ? [
          "",
          "## Guidance",
          input.hint,
        ]
      : []),
    "",
    "Existing milestones (read-only context):",
    JSON.stringify(input.existingMilestones, null, 2),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
    "",
    "Uncovered approved user flows to place in new milestones:",
    JSON.stringify(input.uncoveredUserFlows, null, 2),
  ].join("\n");

export const buildMilestoneDesignPrompt = (input: {
  projectName: string;
  milestoneTitle: string;
  milestoneSummary: string;
  linkedUserFlows: Array<{
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  uxSpec: string;
  technicalSpec: string;
  hint?: string;
  semanticFeedback?: MilestoneDesignSemanticFeedback[];
}) =>
  [
    qualityCharter,
    "For this task, act as a senior software architect breaking delivery scope into implementation workstreams.",
    "",
    "Task:",
    `Create a structured milestone design draft for "${input.milestoneTitle}" in "${input.projectName}".`,
    'Return valid JSON with exactly these top-level keys: "title", "objective", "includedUserFlows", "scopeBoundaries", "deliveryGroups", "dependenciesAndSequencing", and "exitCriteria".',
    ...buildMilestoneDesignContractInstructions({ hasLinkedUserFlows: input.linkedUserFlows.length > 0 }),
    ...(input.hint?.trim()
      ? [
          "",
          "Repair guidance:",
          input.hint.trim(),
        ]
      : []),
    ...renderMilestoneDesignSemanticFeedback(input.semanticFeedback),
    "",
    "Milestone summary:",
    input.milestoneSummary,
    "",
    "Linked user flows:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
  ].join("\n");

export const buildMilestoneDesignRepairPrompt = (input: {
  projectName: string;
  milestoneTitle: string;
  milestoneSummary: string;
  linkedUserFlows: Array<{
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  uxSpec: string;
  technicalSpec: string;
  issues: string[];
  draftJson: string;
  hint?: string;
  semanticFeedback?: MilestoneDesignSemanticFeedback[];
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Repair the structured milestone design draft for "${input.milestoneTitle}" in "${input.projectName}".`,
    'Return valid JSON with exactly these top-level keys: "title", "objective", "includedUserFlows", "scopeBoundaries", "deliveryGroups", "dependenciesAndSequencing", and "exitCriteria".',
    "Preserve the milestone scope while resolving the validator issues below into one consistent ownership model.",
    "Do not introduce future-milestone work. Do not rename linked user flows. Do not leave the ambiguity unresolved.",
    "Do not invent future-milestone scope.",
    "Do not leave an exit criterion, transition, ordering rule, or acceptance expectation that depends on anything listed in outOfScope.",
    "If GAME_OVER or another terminal state is mentioned, include only the in-scope trigger. Otherwise remove that transition from the repaired result.",
    ...buildMilestoneDesignContractInstructions({ hasLinkedUserFlows: input.linkedUserFlows.length > 0 }),
    ...(input.hint?.trim()
      ? [
          "",
          "Repair guidance:",
          input.hint.trim(),
        ]
      : []),
    ...renderMilestoneDesignSemanticFeedback(input.semanticFeedback),
    "",
    "Milestone summary:",
    input.milestoneSummary,
    "",
    "Linked user flows:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
    "",
    "Validator issues:",
    JSON.stringify(input.issues, null, 2),
    "",
    "Previous structured milestone design draft:",
    input.draftJson,
  ].join("\n");

export const buildMilestoneDesignSemanticReviewPrompt = (input: {
  projectName: string;
  milestoneTitle: string;
  milestoneSummary: string;
  linkedUserFlows: Array<{
    title: string;
    userStory: string;
    entryPoint: string;
    endState: string;
  }>;
  uxSpec: string;
  technicalSpec: string;
  draftJson: string;
  semanticFeedback?: MilestoneDesignSemanticFeedback[];
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review the structured milestone design draft for "${input.milestoneTitle}" in "${input.projectName}" before it is persisted.`,
    'Return valid JSON with exactly three top-level keys: "ok" (boolean), "issues" (array of strings), and "repairHint" (string or null).',
    "Look for material semantic contradictions that would make downstream feature planning, task planning, or implementation choose incompatible interpretations.",
    "Hard blockers include shared resources with conflicting controllers, incompatible sequencing or ownership rules, impossible platform/API assumptions, exit criteria that contradict delivery responsibilities, and required behaviours that conflict with out-of-scope boundaries.",
    "Examples of hard blockers: one Web Audio GainNode is required to own both a scheduled dampening automation ramp and immediate user volume changes; one section says voice stealing prioritizes most recent and loudest frequencies while another requires stealing the oldest voice.",
    "Do not report minor wording differences, absent implementation details that can reasonably be chosen later, or choices already resolved consistently in the draft.",
    "When a blocking semantic repair checklist is provided, verify that the draft applies every checklist item consistently instead of re-litigating the superseded contradiction.",
    "If a conservative default can make the draft internally consistent, set ok=false and put the exact default to apply in repairHint.",
    "If the draft is coherent enough for feature planning, set ok=true, issues=[], and repairHint=null.",
    "Do not wrap the JSON in code fences.",
    ...renderMilestoneDesignSemanticFeedback(input.semanticFeedback),
    "",
    "Milestone summary:",
    input.milestoneSummary,
    "",
    "Linked user flows:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Approved UX Spec:",
    input.uxSpec,
    "",
    "Approved Technical Spec:",
    input.technicalSpec,
    "",
    "Structured milestone design draft:",
    input.draftJson,
  ].join("\n");

const buildMilestoneDesignContractInstructions = (input: { hasLinkedUserFlows: boolean }) => [
  input.hasLinkedUserFlows
    ? "includedUserFlows must be a non-empty array. Each item must contain: title, summary, steps, deliveryGroupKeys, and screens."
    : "includedUserFlows must be an empty array because this foundation milestone has no linked user flows.",
  input.hasLinkedUserFlows
    ? 'Each includedUserFlows title must exactly match one linked user-flow title from the provided list.'
    : "Do not invent user flows for this milestone. Keep the design focused on project setup, scaffolding, and smoke-path delivery.",
  'scopeBoundaries must be an object with exactly two array keys: "inScope" and "outOfScope". Every in-scope item must contain: item and deliveryGroupKey.',
  "deliveryGroups must be a non-empty array. Each item must contain: key, title, summary, ownedScreens, ownedResponsibilities, dependsOn, mustStayTogether, and mustNotSplit.",
  "Aim for 2–5 delivery groups per milestone. Each group should represent a coherent implementation workstream (e.g., 'Auth API', 'Auth Frontend', 'Session Schema'). Do not split at the file or function level, and do not merge unrelated workstreams into one oversized group.",
  "Each ownedResponsibilities entry must be a concrete, scoped statement — name the specific API endpoint, interaction, data model, or behaviour being built. Avoid generic category labels like 'Handle auth', 'Manage sessions', or 'Implement UI'.",
  "dependenciesAndSequencing must be a non-empty array. Each item must contain: phase, deliveryGroupKeys, and notes.",
  'dependenciesAndSequencing.phase must be a non-empty string label such as "Phase 1", not a number.',
  "dependenciesAndSequencing.deliveryGroupKeys must always be an array, even for one delivery group.",
  "Use stable kebab-case delivery group keys. Every named screen and owned responsibility must belong to exactly one delivery group.",
  "For every screen named in includedUserFlows.screens or exitCriteria.screens, include that screen's owning delivery group in the same flow or exit criterion context.",
  "Keep scopeBoundaries.inScope, deliveryGroups, dependenciesAndSequencing, and exitCriteria aligned to one resolved interpretation of the milestone. If a risk or ambiguity is resolved in one section, apply that same choice everywhere else.",
  "Do not list a trigger, mechanic, ordering rule, or dependency as required in objective, includedUserFlows, deliveryGroups, or exitCriteria if it is listed in outOfScope.",
  "Mention GAME_OVER transitions only when the triggering mechanism is explicitly in scope for this milestone. Otherwise keep the milestone focused on the in-scope loop and omit that transition.",
  "exitCriteria must be a non-empty array. Each item must contain: criterion, deliveryGroupKey, and screens.",
  "Each exitCriteria criterion must describe a verifiable working behaviour a reviewer can check against the running application — not a completion statement. Bad: 'Authentication feature is complete.' Good: 'A new user can register with email and password, receive a session token, and access a protected route.'",
  "The structure must describe one internally consistent milestone. Do not let flow steps, screen ownership, sequencing, or required-vs-optional rules contradict each other.",
  "Choose one conservative interpretation for shared resource ownership, ordering heuristics, and platform/API constraints. Do not leave one section saying a shared resource is controlled by two incompatible mechanisms.",
  "Do not wrap the JSON in code fences.",
  "Use this shape for tricky fields: steps must be an array of strings, outOfScope must be an array of strings, ownedScreens may be [], mustStayTogether and mustNotSplit must be booleans (true/false), and backend-only exit criteria may use screens: [].",
  "",
  "Example JSON fragment:",
  JSON.stringify(
    {
      includedUserFlows: [
        {
          title: "Linked flow title",
          summary: "Short summary.",
          steps: ["User opens signup", "System creates account"],
          deliveryGroupKeys: ["auth-frontend", "auth-backend"],
          screens: ["signup-page"],
        },
      ],
      scopeBoundaries: {
        inScope: [{ item: "User signup", deliveryGroupKey: "auth-backend" }],
        outOfScope: ["Password reset"],
      },
      deliveryGroups: [
        {
          key: "auth-backend",
          title: "Authentication Backend",
          summary: "Owns auth APIs.",
          ownedScreens: [],
          ownedResponsibilities: ["Create account endpoint"],
          dependsOn: [],
          mustStayTogether: true,
          mustNotSplit: false,
        },
      ],
      dependenciesAndSequencing: [
        {
          phase: "Phase 1",
          deliveryGroupKeys: ["auth-backend"],
          notes: "Stand up the account API before dependent UI work.",
        },
      ],
      exitCriteria: [
        {
          criterion: "Signup API stores a session.",
          deliveryGroupKey: "auth-backend",
          screens: [],
        },
      ],
    },
    null,
    2,
  ),
  "",
  "Foundation milestone example:",
  JSON.stringify(
    {
      includedUserFlows: [],
      dependenciesAndSequencing: [
        {
          phase: "Phase 1",
          deliveryGroupKeys: ["foundation-tooling"],
          notes: "Establish repository scaffolding before smoke-path validation.",
        },
      ],
    },
    null,
    2,
  ),
];

export const buildMilestoneFeatureSetPrompt = (input: {
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  milestones: Array<{
    summary: string;
    title: string;
  }>;
  overviewDocument: string;
  projectName: string;
  projectProductSpec: string;
  projectTechnicalSpec: string;
  projectUxSpec: string;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  sizeProfile?: ProjectSizeProfile;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Generate the implementation-ready feature set for milestone "${input.milestone.title}" in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "acceptanceCriteria must be a non-empty array of concrete strings.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Create features only for the selected milestone.",
    "Use the approved planning documents and milestone design document to understand the current context.",
    "A feature must represent one coherent capability or one deliberately grouped cross-cutting workstream, not an implementation task, review step, or single document fragment.",
    "Build on work already planned in earlier or parallel milestones instead of recreating it.",
    "Do not repeat or lightly rename an existing feature from any milestone.",
    "Prefer the smallest set of coherent features that fully covers the milestone without overlap.",
    ...(input.sizeProfile ? [renderFeatureBudgetGuidance(input.sizeProfile)].filter(Boolean) : []),
    "Treat the milestone design document's Included User Flows and Delivery Shape groupings as hard boundary constraints.",
    "Each named flow step, screen, and responsibility in the milestone design document must belong to exactly one feature in the output.",
    "Cover every delivery group named in the milestone design document, including state-management or service groups that do not own screens.",
    "Make the feature set collectively satisfy every milestone exit criterion. Every exit criterion in the milestone design document must map to at least one feature acceptance criterion.",
    "If a delivery group owns a bundle of responsibilities, do not cover only the easiest subset. Rendering groups must cover the full named rendering scope, not just a single asset.",
    "Do not include acceptance criteria that depend on mechanics, collision checks, ordering rules, or behaviors that the milestone design document marks out of scope.",
    "When the milestone design document resolves a risk or ambiguity, use that one interpretation consistently across all generated features and acceptance criteria.",
    "Do not assign a responsibility to one feature while another feature explicitly says that responsibility is out of scope.",
    "If documentation, architecture follow-up, or another cross-cutting concern belongs together for this milestone, keep it in one shared feature instead of splitting it across multiple small features.",
    "Order the proposed features so they can be implemented in a sensible sequence within the milestone.",
    "Prefer concrete vertical slices over vague epics.",
    "Do not wrap the JSON in code fences.",
    "",
    "Approved overview document:",
    input.overviewDocument,
    "",
    "Approved project Product Spec:",
    input.projectProductSpec,
    "",
    "Approved project UX Spec:",
    input.projectUxSpec,
    "",
    "Approved project Technical Spec:",
    input.projectTechnicalSpec,
    "",
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Ordered milestone list:",
    JSON.stringify(input.milestones, null, 2),
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
  ].join("\n");

export const buildMilestoneFeatureSetReviewPrompt = (input: {
  projectName: string;
  milestone: {
    summary: string;
    title: string;
  };
  milestoneDesignDoc: string;
  linkedUserFlows: Array<{
    id: string;
    title: string;
  }>;
  existingFeatures: Array<{
    dependencies: string[];
    milestoneTitle: string;
    summary: string;
    title: string;
  }>;
  draftFeatures: Array<{
    title: string;
    summary: string;
    acceptanceCriteria: string[];
    kind: string;
    priority: string;
  }>;
}) =>
  [
    qualityCharter,
    "",
    "Task:",
    `Review and rewrite the draft feature set for milestone "${input.milestone.title}" in "${input.projectName}".`,
    "Return valid JSON as a non-empty array.",
    "Each item must be an object with exactly these keys: title, summary, acceptanceCriteria, kind, priority.",
    "kind must be one of: screen, menu, dialog, system, service, library, pipeline, placeholder_visual, placeholder_non_visual.",
    "priority must be one of: must_have, should_have, could_have, wont_have.",
    "Review the full set as a whole. Merge task-sized or overlapping features, close obvious milestone coverage gaps, and keep sibling features non-overlapping.",
    "Cross-check the set against the milestone design document's named flow steps, screens, and Delivery Shape groups before finalizing.",
    "Ensure every delivery group named in the milestone design document is covered, including non-visual groups with no screens.",
    "Ensure the reviewed set collectively satisfies every exit criterion from the milestone design document.",
    "Treat partial coverage as incomplete. If a rendering group owns grid, snake, and food rendering, do not approve a set that covers only food rendering.",
    "Remove or rewrite any acceptance criterion that depends on out-of-scope mechanics, collision checks, ordering rules, or future-milestone behavior.",
    "When the milestone design document resolves a risk or ambiguity, keep that one interpretation consistent across the whole reviewed set.",
    "Remove or rewrite any feature boundary that contradicts the milestone design document's ownership model.",
    "Prefer fewer, feature-sized items over many tiny items.",
    "Keep the result scoped only to the selected milestone.",
    "Do not wrap the JSON in code fences.",
    "",
    "Selected milestone:",
    JSON.stringify(input.milestone, null, 2),
    "",
    "Selected milestone design document:",
    input.milestoneDesignDoc,
    "",
    "User flows linked to the selected milestone:",
    JSON.stringify(input.linkedUserFlows, null, 2),
    "",
    "Existing feature catalogue across all milestones:",
    JSON.stringify(input.existingFeatures, null, 2),
    "",
    "First-pass draft feature set:",
    JSON.stringify(input.draftFeatures, null, 2),
  ].join("\n");
