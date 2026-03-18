type ProjectState = "EMPTY" | "BOOTSTRAPPING" | "IMPORTING_A" | "IMPORTING_B" | "READY_PARTIAL" | "READY";

export const isSetupCompletedProjectState = (state: ProjectState) =>
  state === "READY_PARTIAL" || state === "READY";
