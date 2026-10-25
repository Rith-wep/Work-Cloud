import { Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import AdminRoute from "../components/AdminRoute.jsx";
import AdminShellLayout from "../components/AdminShellLayout.jsx";
import RouteProgressBar from "../components/RouteProgressBar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AdminCatalogPage from "../pages/AdminCatalogPage.jsx";
import AdminDashboardPage from "../pages/AdminDashboardPage.jsx";
import AdminAuditLogsPage from "../pages/AdminAuditLogsPage.jsx";
import AdminJobsPage from "../pages/AdminJobsPage.jsx";
import AdminLoginPage from "../pages/AdminLoginPage.jsx";
import AdminUsersPage from "../pages/AdminUsersPage.jsx";

function AdminApp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  useEffect(() => {
    const handleSessionExpired = () => {
      toast.dismiss("session-expired");
      toast.custom(() => (
        <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 shadow-xl" style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}>
          <p className="text-sm font-bold text-indigo-300">{t("auth.sessionExpiredTitle", { defaultValue: "Session Expired" })}</p>
          <p className="mt-1 text-sm text-slate-300">{t("auth.sessionExpiredMessage", { defaultValue: "Your session has expired. Please sign in again." })}</p>
        </div>
      ), { id: "session-expired", duration: 3500 });
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [navigate, t]);
  return <>
    <RouteProgressBar />
    <Toaster position="top-center" toastOptions={{ duration: 3000, className: "!bg-slate-900 !border !border-slate-700 !text-slate-100 shadow-xl rounded-xl", style: { borderRadius: "14px" } }} />
    <Routes>
      <Route path="/login" element={isAuthenticated && user?.isAdmin ? <Navigate to="/" replace /> : <AdminLoginPage />} />
      <Route element={<AdminRoute />}><Route path="/" element={<AdminShellLayout />}>
        <Route index element={<AdminDashboardPage />} /><Route path="users" element={<AdminUsersPage />} /><Route path="jobs" element={<AdminJobsPage />} /><Route path="catalog" element={<AdminCatalogPage />} /><Route path="audit-logs" element={<AdminAuditLogsPage />} />
      </Route></Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  </>;
}
export default AdminApp;
