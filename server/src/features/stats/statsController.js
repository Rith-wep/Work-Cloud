import Application from "../applications/Application.js";
import Job from "../jobs/Job.js";

const buildEmployerStats = async (companyId) => {
  const jobs = await Job.find({ companyId })
    .select("_id status vacancies hiredCount hiringLimit views metadata.views")
    .lean();
  const jobIds = jobs.map((job) => job._id);

  let applicantsCount = 0;
  if (jobIds.length > 0) {
    const appCount = await Application.countDocuments({ companyId });
    applicantsCount = Number(appCount || 0);
  }

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((job) => job.status === "open").length;
  const filledJobs = jobs.filter((job) => {
    const vacancies = Math.max(1, Number(job.vacancies ?? job.hiringLimit) || 1);
    const hiredCount = Math.max(0, Number(job.hiredCount || 0));
    return hiredCount >= vacancies;
  }).length;
  const viewsCount = jobs.reduce(
    (sum, job) => sum + Math.max(Number(job.views || 0), Number(job?.metadata?.views || 0)),
    0
  );

  return {
    activeJobs,
    filledJobs,
    totalJobs,
    jobsCount: totalJobs,
    applicantsCount,
    viewsCount,
  };
};

export const getEmployerStats = async (req, res) => {
  try {
    const stats = await buildEmployerStats(req.user.id);
    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch employer stats: ${error.message}`,
    });
  }
};

export { buildEmployerStats };
