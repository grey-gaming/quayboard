import type {
  AutoAdvanceSession,
  NextActionsResponse,
  PhaseGatesResponse,
} from "@quayboard/shared";

const Stat = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="border border-border/70 bg-panel px-4 py-3">
    <p className="qb-meta-label">{label}</p>
    <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">
      {value}
    </p>
  </div>
);

export const MissionStatsStrip = ({
  phaseGates,
  nextActions,
  session,
}: {
  phaseGates: PhaseGatesResponse | null | undefined;
  nextActions: NextActionsResponse | null | undefined;
  session: AutoAdvanceSession | null | undefined;
}) => {
  const phasesPassed = phaseGates?.phases.filter((p) => p.passed).length ?? 0;
  const phasesTotal = phaseGates?.phases.length ?? 0;
  const actionsCount = nextActions?.actions.length ?? 0;
  const autoAdvanceStatus = session?.status ?? "idle";
  const currentStep = session?.currentStep ?? "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Phases passed" value={`${phasesPassed} / ${phasesTotal}`} />
      <Stat label="Next actions" value={actionsCount} />
      <Stat label="Auto-advance" value={autoAdvanceStatus} />
      <Stat label="Current step" value={currentStep} />
    </div>
  );
};
