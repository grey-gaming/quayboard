import { useState } from "react";
import { Link } from "react-router-dom";

import type {
  AutoAdvanceSession,
  CreativityMode,
  StartAutoAdvanceRequest,
} from "@quayboard/shared";

import {
  useAutoAdvanceReset,
  useAutoAdvanceResume,
  useAutoAdvanceSkipMilestoneReconciliation,
  useAutoAdvanceStart,
  useAutoAdvanceStep,
  useAutoAdvanceStop,
} from "../../hooks/use-auto-advance.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { InfoTooltip } from "../ui/InfoTooltip.js";

const creativityModeOptions: { value: CreativityMode; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "creative", label: "Creative" },
];

const buildStartRequest = (input: {
  creativityMode: CreativityMode;
  skipReviewSteps: boolean;
  skipHumanReview: boolean;
  autoApproveWhenClear: boolean;
  autoRepairMilestoneCoverage: boolean;
  maxConcurrentJobs: number;
}): StartAutoAdvanceRequest | undefined => {
  const request: StartAutoAdvanceRequest = {};

  if (input.creativityMode !== "balanced") {
    request.creativityMode = input.creativityMode;
  }

  if (input.skipReviewSteps) {
    request.skipReviewSteps = true;
  }

  if (input.skipHumanReview) {
    request.skipHumanReview = true;
  }

  if (input.autoApproveWhenClear) {
    request.autoApproveWhenClear = true;
  }

  if (input.autoRepairMilestoneCoverage) {
    request.autoRepairMilestoneCoverage = true;
  }

  if (input.maxConcurrentJobs !== 1) {
    request.maxConcurrentJobs = input.maxConcurrentJobs;
  }

  return Object.keys(request).length > 0 ? request : undefined;
};

const getMutationErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Action failed. Please try again.";

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
  const skipMilestoneMutation = useAutoAdvanceSkipMilestoneReconciliation(projectId);

  const [creativityMode, setCreativityMode] = useState<CreativityMode>("balanced");
  const [skipReviewSteps, setSkipReviewSteps] = useState(false);
  const [skipHumanReview, setSkipHumanReview] = useState(false);
  const [autoApproveWhenClear, setAutoApproveWhenClear] = useState(false);
  const [autoRepairMilestoneCoverage, setAutoRepairMilestoneCoverage] =
    useState(false);
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState(1);

  const isPending =
    startMutation.isPending ||
    stopMutation.isPending ||
    resumeMutation.isPending ||
    resetMutation.isPending ||
    stepMutation.isPending ||
    skipMilestoneMutation.isPending;

  const status = session?.status ?? "idle";
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isCompleted = status === "completed" || status === "failed";
  const isActive = isRunning || isPaused;
  const isHumanBlockedMilestoneReconciliation =
    isPaused &&
    (session?.pausedReason === "needs_human" ||
      session?.pausedReason === "milestone_repair_limit_reached") &&
    (nextStep === "milestone_reconciliation_resolve" ||
      nextStep === "milestone_scope_resolve" ||
      nextStep === "milestone_delivery_resolve");

  const displayCreativityMode = isActive ? session!.creativityMode : creativityMode;
  const displaySkipReviewSteps = isActive ? session!.skipReviewSteps : skipReviewSteps;
  const displaySkipHumanReview = isActive ? session!.skipHumanReview : skipHumanReview;
  const displayAutoApproveWhenClear = isActive ? session!.autoApproveWhenClear : autoApproveWhenClear;
  const displayAutoRepairMilestoneCoverage = isActive
    ? session!.autoRepairMilestoneCoverage
    : autoRepairMilestoneCoverage;
  const displayMaxConcurrentJobs = isActive ? session!.maxConcurrentJobs : maxConcurrentJobs;
  const actionError =
    startMutation.error ||
    stopMutation.error ||
    resumeMutation.error ||
    resetMutation.error ||
    stepMutation.error ||
    skipMilestoneMutation.error;
  const actionErrorMessage = actionError ? getMutationErrorMessage(actionError) : null;

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
            <label className="flex items-center gap-1 text-xs text-secondary" htmlFor="creativity-mode">
              Creativity mode
              <InfoTooltip text="Controls how inventive the AI is when generating content. Conservative favours safe, predictable output; Creative favours novel ideas. Balanced is recommended for most runs." />
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
            <label className="flex items-center gap-1 text-xs text-secondary" htmlFor="skip-review-steps">
              Skip review steps
              <InfoTooltip text="Automatically accepts all approval gates (overviews, specs, blueprints, decision cards, feature approvals) without pausing. Use for fully unattended runs where you trust the AI output." />
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
            <label className="flex items-center gap-1 text-xs text-secondary" htmlFor="skip-human-review">
              Skip human review
              <InfoTooltip text="When milestone map, scope, reconciliation, delivery, or follow-up repair checks flag issues that would normally require human intervention, automatically bypasses the human-review gate and continues. Equivalent to clicking 'Skip & continue' manually." />
            </label>
            <input
              id="skip-human-review"
              type="checkbox"
              className="h-4 w-4 accent-accent disabled:opacity-60"
              checked={displaySkipHumanReview}
              disabled={isActive || isPending}
              onChange={(e) => setSkipHumanReview(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-1 text-xs text-secondary" htmlFor="auto-approve-when-clear">
              Auto-approve gates
              <InfoTooltip text="Automatically approves review gates (overviews, specs, blueprints, feature approvals) when the artifact is ready. Unlike 'Skip review steps', does not auto-select decision cards." />
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
              className="flex items-center gap-1 text-xs text-secondary"
              htmlFor="auto-repair-milestone-coverage"
            >
              Auto-repair milestone coverage
              <InfoTooltip text="When a milestone scope or delivery review finds structural issues (e.g. missing or misaligned features), automatically queues repair jobs and retries rather than pausing. Up to 3 repair attempts per milestone." />
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
            <label className="flex items-center gap-1 text-xs text-secondary" htmlFor="max-concurrent-jobs">
              Max parallel jobs
              <InfoTooltip text="How many jobs can run simultaneously. Higher values speed up feature-heavy milestones but increase LLM API usage and cost. Start with 1 and increase once you are confident in output quality." />
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
                startMutation.mutate(
                  buildStartRequest({
                    creativityMode,
                    skipReviewSteps,
                    skipHumanReview,
                    autoApproveWhenClear,
                    autoRepairMilestoneCoverage,
                    maxConcurrentJobs,
                  }),
                )
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
                <>
                  <Link
                    className="inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover"
                    to={`/projects/${projectId}/milestones`}
                  >
                    Review milestone gaps
                  </Link>
                  <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => skipMilestoneMutation.mutate()}
                  >
                    Skip &amp; continue
                  </Button>
                </>
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

        {isHumanBlockedMilestoneReconciliation && (
          <p className="text-xs text-secondary">
            Skipping marks this reconciliation step as resolved. Validate milestone coverage manually before skipping.
          </p>
        )}

        {actionErrorMessage && (
          <p className="text-xs text-danger">
            {actionErrorMessage}
          </p>
        )}
      </div>
    </Card>
  );
};
