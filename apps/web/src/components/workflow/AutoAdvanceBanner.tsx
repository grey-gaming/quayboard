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
          {session?.autoResolveAmbiguousReconciliation ? (
            <p className="text-xs text-secondary">
              Ambiguous milestone reconciliation repair is enabled for this session.
            </p>
          ) : null}
          {nextStep && (
            <p className="text-xs text-secondary">
              Next action required: <span className="font-medium text-foreground">{formatStepKey(nextStep)}</span>
            </p>
          )}
          {nextStep === "milestone_reconciliation_resolve" ? (
            <p className="text-xs text-warning">
              Auto-advance cannot continue until the active milestone gaps are resolved in
              Milestones and reconciliation is rerun.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
