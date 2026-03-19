import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { usePhaseGatesQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const OverviewApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const phaseGatesQuery = usePhaseGatesQuery(id);

  if (phaseGatesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const overviewPhase = phaseGatesQuery.data?.phases.find(
    (phase) => phase.phase === "Overview Document",
  );
  const overviewApproved = overviewPhase?.items.find((item) => item.key === "overview")?.passed;

  if (!overviewApproved) {
    return (
      <Navigate
        replace
        state={{ lockedFromPath: location.pathname }}
        to={`/projects/${id}/one-pager`}
      />
    );
  }

  return <Outlet />;
};
