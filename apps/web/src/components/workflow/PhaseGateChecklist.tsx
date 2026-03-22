import type { PhaseGatesResponse } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";

export const PhaseGateChecklist = ({
  phases,
}: {
  phases: PhaseGatesResponse["phases"];
}) => (
  <div className="grid gap-3 lg:grid-cols-2">
    {phases.map((phase) => (
      <div key={phase.phase} className="border border-border/80 bg-panel-inset p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium tracking-[-0.02em]">{phase.phase}</p>
          <Badge tone={phase.items.every((item) => item.passed) ? "success" : "warning"}>
            {phase.items.filter((item) => item.passed).length}/{phase.items.length}
          </Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {phase.items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-sm"
            >
              <span>{item.label}</span>
              <span className={item.passed ? "text-success" : "text-muted-foreground"}>
                {item.passed ? "passed" : "pending"}
              </span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
