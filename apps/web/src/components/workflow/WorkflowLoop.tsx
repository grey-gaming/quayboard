import { Badge } from "../ui/Badge.js";

type WorkflowLoopProps = {
  currentPhase: string;
  phases: Array<{
    label: string;
    passed: boolean;
  }>;
};

export const WorkflowLoop = ({ currentPhase, phases }: WorkflowLoopProps) => (
  <div className="grid gap-3 border border-border/80 bg-panel-inset px-4 py-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="qb-meta-label">Workflow</p>
        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Planning Loop</p>
      </div>
      <Badge tone="info">{currentPhase}</Badge>
    </div>
    <div className="grid gap-2 md:grid-cols-5">
      {phases.map((phase) => (
        <div
          key={phase.label}
          className={[
            "border px-3 py-3 text-sm",
            phase.passed
              ? "border-success/50 bg-success/10 text-foreground"
              : phase.label === currentPhase
                ? "border-accent/50 bg-accent/10 text-foreground"
                : "border-border/70 bg-panel text-secondary",
          ].join(" ")}
        >
          <p className="font-medium">{phase.label}</p>
          <p className="mt-1 qb-meta-label">{phase.passed ? "passed" : "in progress"}</p>
        </div>
      ))}
    </div>
  </div>
);
