import { useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildMissionControlTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { AutoAdvanceBanner } from "../components/workflow/AutoAdvanceBanner.js";
import { AutoAdvanceControlsCard } from "../components/workflow/AutoAdvanceControlsCard.js";
import { MissionActivityTimeline } from "../components/workflow/MissionActivityTimeline.js";
import { MissionStatsStrip } from "../components/workflow/MissionStatsStrip.js";
import { NextActionsPanel } from "../components/workflow/NextActionsPanel.js";
import { PhaseGateChecklist } from "../components/workflow/PhaseGateChecklist.js";
import { Badge } from "../components/ui/Badge.js";
import { useAutoAdvanceQuery } from "../hooks/use-auto-advance.js";
import { useProjectJobsQuery, useProjectQuery } from "../hooks/use-projects.js";
import { usePhaseGates } from "../hooks/use-phase-gates.js";
import { useNextActionsQuery } from "../hooks/use-next-actions.js";

const phaseDisplayOrder = [
  "Project Setup",
  "Overview Document",
  "Product Spec",
  "UX Spec",
  "Technical Spec",
  "User Flows",
  "Milestones",
  "Features",
  "Project Review",
] as const;

const phaseOrderIndex = new Map<string, number>(
  phaseDisplayOrder.map((phase, index) => [phase, index]),
);

export const MissionControlPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const phaseGatesQuery = usePhaseGates(id);
  const nextActionsQuery = useNextActionsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const autoAdvanceQuery = useAutoAdvanceQuery(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  const phases = [...(phaseGatesQuery.data?.phases ?? [])].sort((left, right) => {
    const leftIndex = phaseOrderIndex.get(left.phase) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = phaseOrderIndex.get(right.phase) ?? Number.MAX_SAFE_INTEGER;

    return leftIndex - rightIndex;
  });

  const session = autoAdvanceQuery.data?.session ?? null;
  const nextStep = autoAdvanceQuery.data?.nextStep ?? null;
  const jobs = jobsQuery.data?.jobs ?? [];

  return (
    <ProjectPageFrame
      activeSection="mission-control"
      project={projectQuery.data}
      tertiaryItems={buildMissionControlTertiaryItems(projectQuery.data, jobs)}
    >
      <PageIntro
        eyebrow="Project"
        title="Mission Control"
        summary="Use this page to see the current planning stage, review recent background work, and pick the next action needed to move the project forward."
        meta={
          <>
            <Badge tone="neutral">orchestration surface</Badge>
            <Badge tone="neutral">
              {nextActionsQuery.data?.actions.length ?? 0} next actions
            </Badge>
            <Badge tone="neutral">{jobs.length} tracked jobs</Badge>
          </>
        }
      />

      <AutoAdvanceBanner session={session} nextStep={nextStep} />

      <MissionStatsStrip
        phaseGates={phaseGatesQuery.data}
        nextActions={nextActionsQuery.data}
        session={session}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_20rem] xl:items-start">
        <div className="grid gap-4">
          <NextActionsPanel actions={nextActionsQuery.data?.actions ?? []} />
          <div data-testid="mission-control-phase-gates">
            <PhaseGateChecklist phases={phases} projectId={id} />
          </div>
        </div>
        <div className="grid gap-4 items-start">
          <AutoAdvanceControlsCard projectId={id} session={session} nextStep={nextStep} />
          <MissionActivityTimeline jobs={jobs} projectId={id} />
        </div>
      </div>
    </ProjectPageFrame>
  );
};
