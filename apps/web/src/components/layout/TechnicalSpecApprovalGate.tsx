import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useArtifactStateQuery, useProjectSpecQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const TechnicalSpecApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const technicalSpecQuery = useProjectSpecQuery(id, "tech");
  const artifactStateQuery = useArtifactStateQuery(
    id,
    "blueprint_tech",
    technicalSpecQuery.data?.blueprint?.id ?? null,
  );

  if (technicalSpecQuery.isLoading || artifactStateQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const technicalSpecApproved = Boolean(artifactStateQuery.data?.approval);

  if (!technicalSpecApproved) {
    return (
      <Navigate
        replace
        state={{ lockedFromPath: location.pathname }}
        to={`/projects/${id}/technical-spec`}
      />
    );
  }

  return <Outlet />;
};
