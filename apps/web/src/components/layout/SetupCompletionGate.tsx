import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useProjectQuery } from "../../hooks/use-projects.js";
import { isSetupCompletedProjectState } from "../../lib/project-state.js";
import { Spinner } from "../ui/Spinner.js";

export const SetupCompletionGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const projectQuery = useProjectQuery(id);

  if (projectQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!projectQuery.data) {
    return <Navigate replace to="/" />;
  }

  if (!isSetupCompletedProjectState(projectQuery.data.state)) {
    return (
      <Navigate
        replace
        state={{ lockedFromPath: location.pathname }}
        to={`/projects/${id}/setup`}
      />
    );
  }

  return <Outlet />;
};
