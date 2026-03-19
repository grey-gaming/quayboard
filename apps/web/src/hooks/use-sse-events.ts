import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createSseConnection } from "../lib/sse.js";

export const useSseEvents = (projectId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = createSseConnection("/api/events");
    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: projectId ? ["project", projectId] : undefined,
      });
      if (projectId) {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] }),
          queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager"] }),
          queryClient.invalidateQueries({ queryKey: ["project", projectId, "product-spec"] }),
          queryClient.invalidateQueries({
            queryKey: ["project", projectId, "product-spec-versions"],
          }),
          queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] }),
          queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
          queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
        ]);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    };

    source.addEventListener("job:updated", invalidate);

    return () => {
      source.removeEventListener("job:updated", invalidate);
      source.close();
    };
  }, [projectId, queryClient]);
};
