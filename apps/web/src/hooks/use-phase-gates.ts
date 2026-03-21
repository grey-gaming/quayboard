import { usePhaseGatesQuery } from "./use-projects.js";
import { useSseEvents } from "./use-sse-events.js";

export const usePhaseGates = (projectId: string) => {
  useSseEvents(projectId);
  return usePhaseGatesQuery(projectId);
};
