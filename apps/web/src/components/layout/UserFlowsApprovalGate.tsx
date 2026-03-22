import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useUserFlowsQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const UserFlowsApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const userFlowsQuery = useUserFlowsQuery(id);

  if (userFlowsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!userFlowsQuery.data?.approvedAt) {
    return (
      <Navigate
        replace
        state={{ lockedFromPath: location.pathname }}
        to={`/projects/${id}/user-flows`}
      />
    );
  }

  return <Outlet />;
};
