import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useOnePagerQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const OverviewApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const onePagerQuery = useOnePagerQuery(id);

  if (onePagerQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const overviewApproved = Boolean(onePagerQuery.data?.onePager?.approvedAt);

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
