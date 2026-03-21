import type { PhaseGatesResponse } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";

export const StateMachineVisualizer = ({
  phases,
}: {
  phases: PhaseGatesResponse["phases"];
}) => {
  const firstPendingIndex = phases.findIndex((phase) => !phase.passed);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {phases.map((phase, index) => {
        const isActive = firstPendingIndex === -1 ? index === phases.length - 1 : index === firstPendingIndex;

        return (
          <div
            key={phase.phase}
            className={[
              "border px-4 py-4",
              phase.passed
                ? "border-success/40 bg-success/10"
                : isActive
                  ? "border-accent/45 bg-accent/10"
                  : "border-border/80 bg-panel-inset",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium tracking-[-0.02em]">{phase.phase}</p>
              <Badge tone={phase.passed ? "success" : isActive ? "info" : "neutral"}>
                {phase.passed ? "complete" : isActive ? "current" : "queued"}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
};
