import { useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import RoleDenied from "./RoleDenied.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { toastError } from "../utils/toast.jsx";

function EmployerRoute() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role;
  const hasToastedRef = useRef(false);

  useEffect(() => {
    if (role !== "employer" && !hasToastedRef.current) {
      hasToastedRef.current = true;
      toastError(t("auth.unauthorizedEmployer", { defaultValue: "Unauthorized: Employers only area" }));
    }
    if (role === "employer") {
      hasToastedRef.current = false;
    }
  }, [role]);

  if (role !== "employer") {
    if (role === "candidate") {
      return <Navigate to="/jobs" replace />;
    }
    return (
      <RoleDenied
        message={t("auth.onlyEmployers", { defaultValue: "Only employers can access this feature." })}
      />
    );
  }

  return <Outlet />;
}

export default EmployerRoute;
