import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaFilePdf } from "react-icons/fa/index.js";

import CvPreviewModal from "../../shared/components/CvPreviewModal.jsx";
import LazyAvatar from "../../shared/components/LazyAvatar.jsx";
import { ListSkeleton } from "../../shared/components/PageSkeleton.jsx";
import { useAuth } from "../../shared/context/AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function EmployerApplicantsPage() {
  const { jobId } = useParams();
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [jobTitle, setJobTitle] = useState("Job");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCvSnapshot, setActiveCvSnapshot] = useState(null);
  const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);
  const [isCvPreviewLoading, setIsCvPreviewLoading] = useState(false);

  const fetchApplicants = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/applications/employer/job/${jobId}/applicants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch applicants");
      }
      setApplications(data.applications || []);
      setJobTitle(data.job?.title || "Job");
    } catch (err) {
      setError(err.message || "Failed to fetch applicants");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, token]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const handleOpenCvPreview = async (application) => {
    try {
      setIsCvPreviewLoading(true);
      const rawPath = String(application?.cvSnapshotUrl || "").trim();
      const snapshotPath = rawPath.startsWith("/api/")
        ? rawPath
        : `/api/applications/${application?._id}/cv-snapshot`;
      const response = await fetch(`${API_BASE_URL.replace(/\/api\/?$/, "")}${snapshotPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load CV snapshot");
      }
      setActiveCvSnapshot(data.cvSnapshot || null);
      setIsCvPreviewOpen(true);
    } catch (err) {
      setError(err.message || "Failed to load CV snapshot");
    } finally {
      setIsCvPreviewLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-indigo-700">Applicants for {jobTitle}</h1>
        <p className="text-sm text-slate-600">Review each candidate and open their professional CV snapshot.</p>
      </header>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {isLoading ? <ListSkeleton count={4} /> : null}

      {!isLoading && !applications.length ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No applicants yet.
        </p>
      ) : null}

      {!isLoading && applications.length ? (
        <div className="space-y-3">
          {applications.map((application) => {
            const candidate = application.candidateId || {};
            return (
              <article
                key={application._id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <LazyAvatar
                      src={candidate.profilePicture || ""}
                      alt={candidate.name || "Candidate"}
                      name={candidate.name || "C"}
                      className="h-12 w-12"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {candidate.name || "Candidate"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{candidate.email || "No email"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCvPreview(application)}
                    disabled={isCvPreviewLoading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <FaFilePdf size={13} />
                    <span>{isCvPreviewLoading ? "Loading..." : "View Professional CV"}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <CvPreviewModal
        isOpen={isCvPreviewOpen}
        title="Professional CV"
        data={activeCvSnapshot}
        forceVerifiedBadge
        onClose={() => {
          setIsCvPreviewOpen(false);
          setActiveCvSnapshot(null);
        }}
      />
    </section>
  );
}

export default EmployerApplicantsPage;

