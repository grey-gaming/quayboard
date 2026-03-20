import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useArtifactApprovalQuery, useProjectSpecQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const UxSpecApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const uxSpecQuery = useProjectSpecQuery(id, "ux");
  const artifactApprovalQuery = useArtifactApprovalQuery(
    id,
    "blueprint_ux",
    uxSpecQuery.data?.blueprint?.id ?? null,
  );

  if (uxSpecQuery.isLoading || artifactApprovalQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const uxSpecApproved = Boolean(artifactApprovalQuery.data?.approval);

  if (!uxSpecApproved) {
    return (
      <Navigate replace state={{ lockedFromPath: location.pathname }} to={`/projects/${id}/ux-spec`} />
    );
  }

  return <Outlet />;
};
