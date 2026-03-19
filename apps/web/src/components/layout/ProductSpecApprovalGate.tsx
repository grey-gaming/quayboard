import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { usePhaseGatesQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const ProductSpecApprovalGate = () => {
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

  const productSpecPhase = phaseGatesQuery.data?.phases.find(
    (phase) => phase.phase === "Product Spec",
  );
  const overviewApproved =
    productSpecPhase?.items.find((item) => item.key === "overview_approved")?.passed ?? false;
  const productSpecApproved =
    productSpecPhase?.items.find((item) => item.key === "product_spec_approved")?.passed ?? false;

  if (!overviewApproved) {
    return (
      <Navigate
        replace
        state={{ lockedFromPath: location.pathname }}
        to={`/projects/${id}/one-pager`}
      />
    );
  }

  if (!productSpecApproved) {
    return (
      <Navigate
        replace
        state={{ lockedFromPath: location.pathname }}
        to={`/projects/${id}/product-spec`}
      />
    );
  }

  return <Outlet />;
};
