import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

function ConfirmationModal({
  isOpen,
  title = "Confirm Action",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isConfirming = false,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
              >
                {cancelLabel || t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirming}
                className="h-9 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {confirmLabel || t("common.confirm", { defaultValue: "Confirm" })}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default ConfirmationModal;
