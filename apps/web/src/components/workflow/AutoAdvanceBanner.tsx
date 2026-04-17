import type { AutoAdvanceSession } from "@quayboard/shared";

import { formatStepKey } from "../../lib/format.js";
import { Badge } from "../ui/Badge.js";

const pausedReasonLabel: Record<string, string> = {
  quality_gate_blocker: "quality gate blocker",
  job_failed: "job failed",
  policy_mismatch: "policy mismatch",
  manual_pause: "paused manually",
  budget_exceeded: "budget exceeded",
  needs_human: "waiting for human input",
  milestone_map_repair_limit_reached: "milestone map repair limit reached",
  milestone_repair_limit_reached: "milestone repair limit reached",
  review_limit_reached: "delivery review limit reached",
  ci_fix_budget_exceeded: "CI repair budget exceeded",
  ci_wait_limit_reached: "CI wait limit reached",
  project_review_limit_reached: "project review limit reached",
  project_review_retry_limit_reached: "project review retry limit reached",
  project_review_incomplete: "project review incomplete",
};

const statusTone = (
  status: AutoAdvanceSession["status"],
): "info" | "success" | "warning" | "neutral" => {
  switch (status) {
    case "running":
      return "info";
    case "completed":
      return "success";
    case "paused":
    case "failed":
      return "warning";
    default:
      return "neutral";
  }
};

export const AutoAdvanceBanner = ({
  session,
  nextStep,
}: {
  session: AutoAdvanceSession | null;
  nextStep: string | null;
}) => {
  const status = session?.status ?? "idle";
  const tone = statusTone(status === "idle" ? "idle" : session!.status);
  const pausedLabel =
    session?.pausedReason ? pausedReasonLabel[session.pausedReason] : null;
  const isPaused = status === "paused";

  return (
    <div className="border border-border/70 bg-panel px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="qb-meta-label">Auto-advance</p>
          <Badge tone={tone}>{status}</Badge>
          {session?.currentStep ? (
            <span className="hidden text-xs text-secondary sm:inline">
              step: {formatStepKey(session.currentStep)}
            </span>
          ) : null}
        </div>
        {!isPaused && pausedLabel ? (
          <span className="text-xs text-secondary">{pausedLabel}</span>
        ) : null}
      </div>
      {isPaused && (
        <div className="mt-2 grid gap-1 border-t border-border/60 pt-2">
          {pausedLabel && (
            <p className="text-xs text-warning">Paused: {pausedLabel}</p>
          )}
          {session?.autoRepairMilestoneCoverage ? (
            <p className="text-xs text-secondary">
              Milestone coverage auto-repair is enabled for this session.
            </p>
          ) : null}
          {session && session.milestoneRepairCount > 0 ? (
            <p className="text-xs text-secondary">
              Milestone repair attempts used: {session.milestoneRepairCount}/3
            </p>
          ) : null}
          {session && session.ciFixCount > 0 ? (
            <p className="text-xs text-secondary">CI repair attempts used: {session.ciFixCount}/3</p>
          ) : null}
          {session && session.ciWaitWindowCount > 0 ? (
            <p className="text-xs text-secondary">
              CI wait windows used: {session.ciWaitWindowCount}/12
            </p>
          ) : null}
          {nextStep && (
            <p className="text-xs text-secondary">
              Next action required: <span className="font-medium text-foreground">{formatStepKey(nextStep)}</span>
            </p>
          )}
          {nextStep === "milestone_map_resolve" ? (
            <p className="text-xs text-warning">
              Auto-advance cannot continue until the milestone map issues are resolved in
              Milestones and the map review is rerun.
            </p>
          ) : null}
          {nextStep === "milestone_reconciliation_resolve" ||
          nextStep === "milestone_scope_resolve" ||
          nextStep === "milestone_delivery_resolve" ? (
            <p className="text-xs text-warning">
              Auto-advance cannot continue until the active milestone gaps are resolved in
              Milestones and the relevant review is rerun.
            </p>
          ) : null}
          {session?.pausedReason === "milestone_map_repair_limit_reached" ? (
            <p className="text-xs text-warning">
              Auto-advance tried milestone map repair three times and paused for manual follow-up.
            </p>
          ) : null}
          {session?.pausedReason === "milestone_repair_limit_reached" ? (
            <p className="text-xs text-warning">
              Auto-advance tried milestone coverage repair three times and paused for manual
              follow-up.
            </p>
          ) : null}
          {session?.pausedReason === "needs_human" &&
          session.currentStep === "milestone_design_generate" ? (
            <p className="text-xs text-warning">
              Auto-advance exhausted milestone design retries. Review the milestone inputs or change
              the configured model before rerunning this step.
            </p>
          ) : null}
          {session?.pausedReason === "ci_fix_budget_exceeded" ? (
            <p className="text-xs text-warning">
              Auto-advance tried repairing milestone CI three times and paused for manual follow-up.
            </p>
          ) : null}
          {session?.pausedReason === "ci_wait_limit_reached" ? (
            <p className="text-xs text-warning">
              Auto-advance waited for milestone CI repeatedly and paused because the checks did not settle.
            </p>
          ) : null}
          {session?.pausedReason === "project_review_limit_reached" ? (
            <p className="text-xs text-warning">
              Auto-advance reached the project review fix-loop limit. Open Project Review to inspect the remaining findings and retry fixes when ready.
            </p>
          ) : null}
          {session?.pausedReason === "project_review_retry_limit_reached" ? (
            <p className="text-xs text-warning">
              Auto-advance retried the project review or fix run three times and paused. Open Project Review to inspect the latest failure before retrying.
            </p>
          ) : null}
          {session?.pausedReason === "project_review_incomplete" ? (
            <p className="text-xs text-warning">
              Auto-advance cannot finish while project review remediation is still running, failed, needs fixes, or has an unmerged fixes branch. Open Project Review to continue.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
