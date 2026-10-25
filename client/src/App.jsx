import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import CandidateRoute from "./components/CandidateRoute.jsx";
import EmployerRoute from "./components/EmployerRoute.jsx";
import MainLayout from "./components/MainLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RouteProgressBar from "./components/RouteProgressBar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import ApplyPage from "./pages/ApplyPage.jsx";
import AIChatPage from "./pages/AIChatPage.jsx";
import EmployerLandingPage from "./pages/EmployerLandingPage.jsx";
import EmployerApplicantsPage from "./pages/EmployerApplicantsPage.jsx";
import EmployerRegisterPage from "./pages/EmployerRegisterPage.jsx";
import EditJobPage from "./pages/EditJobPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import JobDetailsPage from "./pages/JobDetailsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import ManageApplications from "./pages/ManageApplications.jsx";
import MyPostingsPage from "./pages/MyPostingsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import PostJobPage from "./pages/PostJobPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import CompanyProfile from "./pages/CompanyProfile.jsx";
import CandidatePublicProfilePage from "./pages/CandidatePublicProfilePage.jsx";
import EmployerPublicProfilePage from "./pages/EmployerPublicProfilePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import SavedJobsPage from "./pages/SavedJobsPage.jsx";
import VerificationSuccessPage from "./pages/VerificationSuccessPage.jsx";

function AppShell() { return <MainLayout><Outlet /></MainLayout>; }
function App() {
  const { t } = useTranslation(); const navigate = useNavigate(); const { isAuthenticated, user } = useAuth();
  const role = user?.role; const homeRedirect = role === "employer" ? "/workspace" : "/jobs";
  const ProfileRouteElement = role === "employer" ? <CompanyProfile /> : <ProfilePage />;
  useEffect(() => {
    const handleSessionExpired = () => {
      toast.dismiss("session-expired");
      toast.custom(() => <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-xl" style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}><p className="text-sm font-bold text-indigo-600">{t("auth.sessionExpiredTitle", { defaultValue: "Session Expired" })}</p><p className="mt-1 text-sm text-slate-700">{t("auth.sessionExpiredMessage", { defaultValue: "Your session has expired. Please sign in again." })}</p></div>, { id: "session-expired", duration: 3500 });
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth:session-expired", handleSessionExpired); return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [navigate, t]);
  return <><RouteProgressBar /><Toaster position="top-center" toastOptions={{ duration: 3000, className: "!bg-white/70 !backdrop-blur-md !border !border-white/40 !text-slate-800 shadow-xl rounded-xl", style: { backdropFilter: "blur(10px)", borderRadius: "14px" } }} /><Routes>
    <Route path="/" element={<Navigate to={isAuthenticated ? homeRedirect : "/login"} replace />} />
    <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route path="/admin/login" element={isAuthenticated ? <Navigate to={homeRedirect} replace /> : <Navigate to="/login" replace />} />
    <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
    <Route path="/register-company" element={isAuthenticated ? <Navigate to="/" replace /> : <EmployerRegisterPage />} />
    <Route path="/employers" element={isAuthenticated ? <Navigate to={homeRedirect} replace /> : <EmployerLandingPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="jobs" element={<HomePage />} /><Route path="map" element={<MapPage />} /><Route path="jobs/:jobId" element={<JobDetailsPage />} /><Route path="employers/:id" element={<EmployerPublicProfilePage />} />
      <Route element={<CandidateRoute />}><Route path="my-apps" element={<ApplyPage />} /><Route path="apply" element={<ApplyPage />} /><Route path="saved-jobs" element={<SavedJobsPage />} /><Route path="ai-chat" element={<AIChatPage />} /><Route path="verification/success" element={<VerificationSuccessPage />} /></Route>
      <Route path="notifications" element={<NotificationsPage />} /><Route path="profile" element={ProfileRouteElement} />
      <Route element={<EmployerRoute />}><Route path="post-job" element={<PostJobPage />} /><Route path="jobs/:jobId/edit" element={<EditJobPage />} /><Route path="my-postings" element={<MyPostingsPage />} /><Route path="workspace" element={<ManageApplications />} /><Route path="manage-applications" element={<ManageApplications />} /><Route path="employer/applicants/:jobId" element={<EmployerApplicantsPage />} /><Route path="candidates/:id" element={<CandidatePublicProfilePage />} /></Route>
      <Route path="*" element={<Navigate to={homeRedirect} replace />} />
    </Route></Route>
  </Routes></>;
}
export default App;
