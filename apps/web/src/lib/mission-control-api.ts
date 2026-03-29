import type {
  AutoAdvanceSession,
  AutoAdvanceStatusResponse,
  StartAutoAdvanceRequest,
} from "@quayboard/shared";

import { apiRequest } from "./api.js";

export const missionControlApi = {
  getAutoAdvanceStatus(projectId: string) {
    return apiRequest<AutoAdvanceStatusResponse>(
      `/api/projects/${projectId}/auto-advance/status`,
    );
  },

  startAutoAdvance(projectId: string, opts?: StartAutoAdvanceRequest) {
    return apiRequest<AutoAdvanceSession>(
      `/api/projects/${projectId}/auto-advance/start`,
      {
        method: "POST",
        body: JSON.stringify(opts ?? {}),
      },
    );
  },

  stopAutoAdvance(projectId: string) {
    return apiRequest<AutoAdvanceSession>(
      `/api/projects/${projectId}/auto-advance/stop`,
      { method: "POST" },
    );
  },

  resumeAutoAdvance(projectId: string) {
    return apiRequest<AutoAdvanceSession>(
      `/api/projects/${projectId}/auto-advance/resume`,
      { method: "POST" },
    );
  },

  resetAutoAdvance(projectId: string) {
    return apiRequest<void>(`/api/projects/${projectId}/auto-advance/reset`, {
      method: "POST",
    });
  },

  stepAutoAdvance(projectId: string) {
    return apiRequest<AutoAdvanceSession>(
      `/api/projects/${projectId}/auto-advance/step`,
      { method: "POST" },
    );
  },

  skipMilestoneReconciliation(projectId: string) {
    return apiRequest<AutoAdvanceSession>(
      `/api/projects/${projectId}/auto-advance/skip-milestone-reconciliation`,
      { method: "POST" },
    );
  },
};
