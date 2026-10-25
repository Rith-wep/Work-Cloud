import { FaLock } from "react-icons/fa/index.js";
import { useTranslation } from "react-i18next";

function RoleDenied({ message = "You do not have permission to access this feature." }) {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <FaLock size={22} className="text-slate-500" />
      </div>
      <h2 className="mt-3 text-lg font-bold text-slate-900">
        {t("auth.accessRestricted", { defaultValue: "Access Restricted" })}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
    </section>
  );
}

export default RoleDenied;
