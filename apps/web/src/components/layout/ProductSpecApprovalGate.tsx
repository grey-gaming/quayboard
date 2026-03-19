import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { useOnePagerQuery, useProductSpecQuery } from "../../hooks/use-projects.js";
import { Spinner } from "../ui/Spinner.js";

export const ProductSpecApprovalGate = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const onePagerQuery = useOnePagerQuery(id);
  const productSpecQuery = useProductSpecQuery(id);

  if (onePagerQuery.isLoading || productSpecQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const overviewApproved = Boolean(onePagerQuery.data?.onePager?.approvedAt);
  const productSpecApproved = Boolean(productSpecQuery.data?.productSpec?.approvedAt);

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
