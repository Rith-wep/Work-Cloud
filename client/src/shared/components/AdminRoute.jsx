import { Navigate, Outlet, useLocation } from "react-router-dom";

import RoleDenied from "./RoleDenied.jsx";
import { AppBootSkeleton } from "./PageSkeleton.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { hasAdminConsoleAccess } from "../utils/admin.js";

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
