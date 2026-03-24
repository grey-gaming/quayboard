import type { AutoAdvanceSession } from "@quayboard/shared";

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
}: {
  session: AutoAdvanceSession | null;
}) => {
  const status = session?.status ?? "idle";
  const tone = statusTone(status === "idle" ? "idle" : session!.status);
  const pausedLabel =
    session?.pausedReason ? pausedReasonLabel[session.pausedReason] : null;

  return (
    <div className="flex items-center justify-between gap-4 border border-border/70 bg-panel px-4 py-3">
      <div className="flex items-center gap-3">
        <p className="qb-meta-label">Auto-advance</p>
        <Badge tone={tone}>{status}</Badge>
        {session?.currentStep ? (
          <span className="hidden text-xs text-secondary sm:inline">
            step: {session.currentStep}
          </span>
        ) : null}
      </div>
      {pausedLabel ? (
        <span className="text-xs text-secondary">{pausedLabel}</span>
      ) : null}
    </div>
  );
};
