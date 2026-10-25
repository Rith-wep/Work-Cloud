import { Navigate, Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { AppBootSkeleton } from "./PageSkeleton.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();
  if (isBootstrapping) {
    return <AppBootSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
