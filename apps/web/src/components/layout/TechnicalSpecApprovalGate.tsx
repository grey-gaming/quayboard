import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useArtifactApprovalQuery, useProjectSpecQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const TechnicalSpecApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const technicalSpecQuery = useProjectSpecQuery(id, "tech");
  const artifactApprovalQuery = useArtifactApprovalQuery(
    id,
    "blueprint_tech",
    technicalSpecQuery.data?.blueprint?.id ?? null,
  );

  if (technicalSpecQuery.isLoading || artifactApprovalQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const technicalSpecApproved = Boolean(artifactApprovalQuery.data?.approval);

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
