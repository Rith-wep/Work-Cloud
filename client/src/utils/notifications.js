export const getNotificationKind = (notification) => {
  const type = String(notification?.type || "system").toLowerCase();
  if (type === "job_alert") {
    return "job_alert";
  }
  if (type === "new_application") {
    return "application";
  }
  if (type === "job_interview_scheduled") {
    return "interview";
  }
  if (["job_accepted", "arrival_confirmed"].includes(type)) {
    return "success";
  }
  return "default";
};

export const getNotificationTheme = (notification) => {
  const kind = getNotificationKind(notification);
  if (kind === "job_alert") {
    return {
      accent: "bg-amber-100 text-amber-700",
      dot: "bg-amber-500",
      ring: "ring-amber-200",
    };
  }
  if (kind === "application") {
    return {
      accent: "bg-blue-100 text-blue-700",
      dot: "bg-blue-500",
      ring: "ring-blue-200",
    };
  }
  if (kind === "interview") {
    return {
      accent: "bg-violet-100 text-violet-700",
      dot: "bg-violet-500",
      ring: "ring-violet-200",
    };
  }
  if (kind === "success") {
    return {
      accent: "bg-emerald-100 text-emerald-700",
      dot: "bg-emerald-500",
      ring: "ring-emerald-200",
    };
  }
  return {
    accent: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    ring: "ring-slate-200",
  };
};

export const getInterviewJoinWindowState = (notification) => {
  const metadata = notification?.metadata || {};
  const interviewLink = String(metadata.interviewLink || metadata.meetingLink || "").trim();
  const interviewStartAt = String(metadata.interviewStartAt || "").trim();
  if (!interviewLink || !interviewStartAt) {
    return { canJoin: false, href: "", minutesUntil: null };
  }

  const startAt = new Date(interviewStartAt);
  if (Number.isNaN(startAt.getTime())) {
    return { canJoin: false, href: "", minutesUntil: null };
  }

  const diffMinutes = Math.round((startAt.getTime() - Date.now()) / 60000);
  const canJoin = diffMinutes <= 20 && diffMinutes >= -120;
  return {
    canJoin,
    href: interviewLink,
    minutesUntil: diffMinutes,
  };
};

export const getNotificationTargetPath = (notification, role = "") => {
  const metadata = notification?.metadata || {};
  const applicationId = String(metadata.applicationId || "").trim();
  const jobId = String(metadata.jobId || "").trim();
  const normalizedRole = String(role || "").toLowerCase();
  const type = String(notification?.type || "system").toLowerCase();

  if (normalizedRole === "employer") {
    if (applicationId && ["new_application", "arrival_submitted"].includes(type)) {
      return `/workspace?tab=applications&highlightApp=${applicationId}`;
    }
    if (jobId) {
      return `/workspace?tab=listings&highlightJob=${jobId}`;
    }
    if (applicationId) {
      return `/workspace?tab=applications&highlightApp=${applicationId}`;
    }
    return "/workspace";
  }

  if (type === "job_alert" && jobId) {
    return `/jobs/${jobId}`;
  }

  if (applicationId) {
    return `/my-apps?highlightApp=${applicationId}`;
  }
  if (jobId) {
    return `/jobs/${jobId}?highlightJob=${jobId}`;
  }
  return "/notifications";
};

export const getNotificationMessage = (notification, t) => {
  const type = notification?.type || "system";
  const metadata = notification?.metadata || {};
  const explicitMessageKey = String(notification?.messageKey || "").trim();

  if (explicitMessageKey) {
    return t(explicitMessageKey, {
      candidateName: metadata.candidateName || t("notifications.aCandidate", { defaultValue: "A candidate" }),
      jobTitle: metadata.jobTitle || t("notifications.yourJob", { defaultValue: "your job" }),
      views: metadata.views,
      defaultValue: notification?.message || t("notifications.defaultMessage", { defaultValue: "You have a new update." }),
    });
  }

  if (type === "new_application") {
    return t("notifications.types.new_application", {
      candidateName: metadata.candidateName || t("notifications.aCandidate", { defaultValue: "A candidate" }),
      jobTitle: metadata.jobTitle || t("notifications.yourJob", { defaultValue: "your job" }),
    });
  }
  if (type === "job_alert") {
    return notification?.message || t("notifications.defaultMessage", { defaultValue: "You have a new update." });
  }
  if (type === "job_accepted") {
    return t("notifications.types.job_accepted", {
      jobTitle: metadata.jobTitle || t("notifications.aJob", { defaultValue: "a job" }),
    });
  }
  if (type === "job_rejected") {
    return t("notifications.types.job_rejected", {
      jobTitle: metadata.jobTitle || t("notifications.aJob", { defaultValue: "a job" }),
    });
  }
  if (type === "job_interview_scheduled") {
    return t("notifications.types.job_interview_scheduled", {
      jobTitle: metadata.jobTitle || t("notifications.aJob", { defaultValue: "a job" }),
      interviewDateTime:
        metadata.interviewDateTime ||
        t("notifications.interviewDateTime", { defaultValue: "the scheduled time" }),
      defaultValue:
        notification?.message ||
        `Interview scheduled for ${metadata.jobTitle || "a job"} at ${
          metadata.interviewDateTime || "the scheduled time"
        }.`,
    });
  }
  if (type === "arrival_submitted") {
    return t("notifications.types.arrival_submitted", {
      candidateName: metadata.candidateName || t("notifications.aCandidate", { defaultValue: "A candidate" }),
      jobTitle: metadata.jobTitle || t("notifications.yourJob", { defaultValue: "your job" }),
    });
  }
  if (type === "arrival_confirmed") {
    return t("notifications.types.arrival_confirmed", {
      jobTitle: metadata.jobTitle || t("notifications.aJob", { defaultValue: "a job" }),
    });
  }
  if (type === "no_show_reported") {
    return t("notifications.types.no_show_reported", {
      jobTitle: metadata.jobTitle || t("notifications.aJob", { defaultValue: "a job" }),
    });
  }
  if (type === "system" && metadata?.views) {
    return t("notifications.types.job_views", {
      jobTitle: metadata.jobTitle || t("notifications.yourJob", { defaultValue: "your job" }),
      views: metadata.views,
    });
  }
  return notification?.message || t("notifications.defaultMessage", { defaultValue: "You have a new update." });
};
