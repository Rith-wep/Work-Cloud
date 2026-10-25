import toast from "react-hot-toast";
import { FaCheckCircle, FaExclamationCircle, FaSpinner } from "react-icons/fa/index.js";

const baseOptions = {
  duration: 3000,
  className:
    "!bg-white/70 !backdrop-blur-md !border !border-white/40 !text-slate-800 shadow-xl rounded-xl [font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]",
};

export const toastSuccess = (message) =>
  toast.success(message, {
    ...baseOptions,
    icon: <FaCheckCircle className="text-emerald-600" />,
  });

export const toastError = (message) =>
  toast.error(message, {
    ...baseOptions,
    icon: <FaExclamationCircle className="text-rose-600" />,
  });

export const toastPromise = (promise, { loading, success, error }) =>
  toast.promise(promise, {
    loading: (
      <span className="inline-flex items-center gap-2">
        <FaSpinner className="animate-spin text-primary" />
        <span>{loading}</span>
      </span>
    ),
    success: (value) => (
      <span className="inline-flex items-center gap-2">
        <FaCheckCircle className="text-emerald-600" />
        <span>{typeof success === "function" ? success(value) : success}</span>
      </span>
    ),
    error: (err) => (
      <span className="inline-flex items-center gap-2">
        <FaExclamationCircle className="text-rose-600" />
        <span>{typeof error === "function" ? error(err) : error}</span>
      </span>
    ),
  });

export const toastNotification = ({
  message,
  avatarUrl = "",
  senderName = "",
  fontClassName = "",
}) =>
  toast.custom(
    () => (
      <div className="flex max-w-sm items-center gap-3 rounded-xl border border-white/40 bg-white/80 p-3 text-slate-800 shadow-xl backdrop-blur-md">
        <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-200">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={senderName || "Sender"}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
              {String(senderName || "N").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <p className={`text-sm font-medium ${fontClassName}`.trim()}>{message}</p>
      </div>
    ),
    { duration: 3000 }
  );

