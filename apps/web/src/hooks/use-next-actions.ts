import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api.js";

export const useNextActionsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "next-actions"],
    queryFn: () => api.getNextActions(projectId),
  });
