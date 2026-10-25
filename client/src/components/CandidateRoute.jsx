import { useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import RoleDenied from "./RoleDenied.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { toastError } from "../utils/toast.jsx";

function CandidateRoute() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role;
  const hasToastedRef = useRef(false);

  useEffect(() => {
    if (role !== "candidate" && !hasToastedRef.current) {
      hasToastedRef.current = true;
      toastError(t("auth.unauthorizedCandidate", { defaultValue: "Unauthorized: Candidates only area" }));
    }
    if (role === "candidate") {
      hasToastedRef.current = false;
    }
  }, [role]);

  if (role !== "candidate") {
    if (role === "employer") {
      return <Navigate to="/workspace" replace />;
    }
    return (
      <RoleDenied
        message={t("auth.onlyCandidates", { defaultValue: "Only candidates can access this feature." })}
      />
    );
  }

  return <Outlet />;
}

export default CandidateRoute;
