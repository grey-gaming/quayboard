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
}: {
  projectId: string;
  session: AutoAdvanceSession | null;
}) => {
  const startMutation = useAutoAdvanceStart(projectId);
  const stopMutation = useAutoAdvanceStop(projectId);
  const resumeMutation = useAutoAdvanceResume(projectId);
  const resetMutation = useAutoAdvanceReset(projectId);
  const stepMutation = useAutoAdvanceStep(projectId);

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
        <div className="flex flex-wrap gap-2">
          {(status === "idle" || isCompleted) && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() => startMutation.mutate(undefined)}
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

        {session && (
          <div className="grid gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-secondary" htmlFor="creativity-mode">
                Creativity mode
              </label>
              <select
                id="creativity-mode"
                className="border border-border/70 bg-panel px-2 py-1 text-xs text-foreground"
                value={session.creativityMode}
                disabled
              >
                {creativityModeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-secondary">Skip review steps</label>
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={session.skipReviewSteps}
                disabled
                readOnly
              />
            </div>
          </div>
        )}

        {(startMutation.isError || stopMutation.isError || resumeMutation.isError || resetMutation.isError || stepMutation.isError) && (
          <p className="text-xs text-danger">
            Action failed. Please try again.
          </p>
        )}
      </div>
    </Card>
  );
};
