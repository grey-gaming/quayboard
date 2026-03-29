import { useState } from "react";
import { Link } from "react-router-dom";

import type { AutoAdvanceSession, CreativityMode } from "@quayboard/shared";

import {
  useAutoAdvanceReset,
  useAutoAdvanceResume,
  useAutoAdvanceStart,
  useAutoAdvanceStep,
  useAutoAdvanceStop,
} from "../../hooks/use-auto-advance.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";

const creativityModeOptions: { value: CreativityMode; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "creative", label: "Creative" },
];

export const AutoAdvanceControlsCard = ({
  projectId,
  session,
  nextStep,
}: {
  projectId: string;
  session: AutoAdvanceSession | null;
  nextStep: string | null;
}) => {
  const startMutation = useAutoAdvanceStart(projectId);
  const stopMutation = useAutoAdvanceStop(projectId);
  const resumeMutation = useAutoAdvanceResume(projectId);
  const resetMutation = useAutoAdvanceReset(projectId);
  const stepMutation = useAutoAdvanceStep(projectId);

  const [creativityMode, setCreativityMode] = useState<CreativityMode>("balanced");
  const [skipReviewSteps, setSkipReviewSteps] = useState(false);
  const [autoApproveWhenClear, setAutoApproveWhenClear] = useState(false);
  const [autoRepairMilestoneCoverage, setAutoRepairMilestoneCoverage] =
    useState(false);
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState(1);

  const isPending =
    startMutation.isPending ||
    stopMutation.isPending ||
    resumeMutation.isPending ||
    resetMutation.isPending ||
    stepMutation.isPending;

  const status = session?.status ?? "idle";
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isCompleted = status === "completed" || status === "failed";
  const isActive = isRunning || isPaused;
  const isHumanBlockedMilestoneReconciliation =
    isPaused &&
    (session?.pausedReason === "needs_human" ||
      session?.pausedReason === "milestone_repair_limit_reached") &&
    nextStep === "milestone_reconciliation_resolve";

  const displayCreativityMode = isActive ? session!.creativityMode : creativityMode;
  const displaySkipReviewSteps = isActive ? session!.skipReviewSteps : skipReviewSteps;
  const displayAutoApproveWhenClear = isActive ? session!.autoApproveWhenClear : autoApproveWhenClear;
  const displayAutoRepairMilestoneCoverage = isActive
    ? session!.autoRepairMilestoneCoverage
    : autoRepairMilestoneCoverage;
  const displayMaxConcurrentJobs = isActive ? session!.maxConcurrentJobs : maxConcurrentJobs;

  return (
    <Card surface="rail" className="h-fit">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <p className="qb-meta-label">Automation</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Auto-Advance</p>
        </div>
        <Badge tone="neutral">orchestration</Badge>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-secondary" htmlFor="creativity-mode">
              Creativity mode
            </label>
            <select
              id="creativity-mode"
              className="border border-border/70 bg-panel px-2 py-1 text-xs text-foreground disabled:opacity-60"
              value={displayCreativityMode}
              disabled={isActive || isPending}
              onChange={(e) => setCreativityMode(e.target.value as CreativityMode)}
            >
              {creativityModeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-secondary" htmlFor="skip-review-steps">
              Skip review steps
            </label>
            <input
              id="skip-review-steps"
              type="checkbox"
              className="h-4 w-4 accent-accent disabled:opacity-60"
              checked={displaySkipReviewSteps}
              disabled={isActive || isPending}
              onChange={(e) => setSkipReviewSteps(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-secondary" htmlFor="auto-approve-when-clear">
              Auto-approve gates
            </label>
            <input
              id="auto-approve-when-clear"
              type="checkbox"
              className="h-4 w-4 accent-accent disabled:opacity-60"
              checked={displayAutoApproveWhenClear}
              disabled={isActive || isPending}
              onChange={(e) => setAutoApproveWhenClear(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-xs text-secondary"
              htmlFor="auto-repair-milestone-coverage"
            >
              Auto-repair milestone coverage
            </label>
            <input
              id="auto-repair-milestone-coverage"
              type="checkbox"
              className="h-4 w-4 accent-accent disabled:opacity-60"
              checked={displayAutoRepairMilestoneCoverage}
              disabled={isActive || isPending}
              onChange={(e) => setAutoRepairMilestoneCoverage(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-secondary" htmlFor="max-concurrent-jobs">
              Max parallel jobs
            </label>
            <input
              id="max-concurrent-jobs"
              type="number"
              min={1}
              max={10}
              className="w-14 border border-border/70 bg-panel px-2 py-1 text-xs text-foreground disabled:opacity-60"
              value={displayMaxConcurrentJobs}
              disabled={isActive || isPending}
              onChange={(e) => setMaxConcurrentJobs(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(status === "idle" || isCompleted) && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                startMutation.mutate({
                  creativityMode,
                  skipReviewSteps,
                  autoApproveWhenClear,
                  autoRepairMilestoneCoverage,
                  maxConcurrentJobs,
                })
              }
            >
              Start
            </Button>
          )}
          {isRunning && (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => stopMutation.mutate()}
            >
              Stop
            </Button>
          )}
          {isPaused && (
            <>
              {isHumanBlockedMilestoneReconciliation ? (
                <Link
                  className="inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover"
                  to={`/projects/${projectId}/milestones`}
                >
                  Review milestone gaps
                </Link>
              ) : (
                <>
                  <Button
                    variant="primary"
                    disabled={isPending}
                    onClick={() => resumeMutation.mutate()}
                  >
                    Resume
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => stepMutation.mutate()}
                  >
                    Step once
                  </Button>
                </>
              )}
            </>
          )}
          {session && (
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => resetMutation.mutate()}
            >
              Reset
            </Button>
          )}
        </div>

        {(startMutation.isError || stopMutation.isError || resumeMutation.isError || resetMutation.isError || stepMutation.isError) && (
          <p className="text-xs text-danger">
            Action failed. Please try again.
          </p>
        )}
      </div>
    </Card>
  );
};
