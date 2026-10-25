import { Navigate, Outlet, useLocation } from "react-router-dom";

import RoleDenied from "../../shared/components/RoleDenied.jsx";
import { AppBootSkeleton } from "../../shared/components/PageSkeleton.jsx";
import { useAuth } from "../../shared/context/AuthContext.jsx";
import { hasAdminConsoleAccess } from "../../shared/utils/admin.js";

function AdminRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <AppBootSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasAdminConsoleAccess(user)) {
    return (
      <RoleDenied message="Only moderators and super administrators can access the admin console." />
    );
  }

  return <Outlet />;
}

export default AdminRoute;


