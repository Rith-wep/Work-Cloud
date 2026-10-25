import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const LANGUAGES = [
  { code: "en", label: "English", badge: "US" },
  { code: "km", label: "\u1797\u17b6\u179f\u17b6\u1781\u17d2\u1798\u17c2\u179a", badge: "KH" },
  { code: "zh", label: "\u4e2d\u6587", badge: "CN" },
];

function LanguageSwitcher({ onLanguageChange, className = "", menuPlacement = "down" }) {
  const { i18n } = useTranslation();
  const { isAuthenticated, changePreferredLanguage } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState("down");
  const containerRef = useRef(null);
  const active = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const activeLanguage = LANGUAGES.find((item) => item.code === active) || LANGUAGES[0];

  useEffect(() => {
    if (!isOpen) return;

    if (menuPlacement === "up" || menuPlacement === "down") {
      setResolvedPlacement(menuPlacement);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setResolvedPlacement("down");
      return;
    }

    const estimatedMenuHeight = 168;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
      setResolvedPlacement("up");
      return;
    }
    setResolvedPlacement("down");
  }, [isOpen, menuPlacement]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuPositionClass = resolvedPlacement === "up" ? "bottom-12" : "top-12";

  const changeLanguage = async (lang, event) => {
    event?.preventDefault();
    event?.stopPropagation();

    const normalized = String(lang || "en").toLowerCase().split("-")[0];

    localStorage.setItem("i18nextLng", normalized);
    localStorage.setItem("preferredLanguage", normalized);
    await i18n.changeLanguage(normalized);

    if (typeof onLanguageChange === "function") {
      setIsOpen(false);
      onLanguageChange(normalized);
      return;
    }

    if (isAuthenticated && typeof changePreferredLanguage === "function") {
      changePreferredLanguage(normalized).catch(() => {});
    }

    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex h-9 min-w-[138px] w-[138px] flex-nowrap items-center justify-between whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 sm:h-10 sm:min-w-[180px] sm:w-[180px] sm:px-3 sm:text-sm"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 min-w-7 items-center justify-center rounded-md bg-slate-100 px-1 text-[10px] font-bold tracking-wide text-slate-600">
            {activeLanguage.badge}
          </span>
          <span
            className="wc-lang-label block whitespace-nowrap"
            data-lang={activeLanguage.code}
            style={
              activeLanguage.code === "km"
                ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                : undefined
            }
          >
            {activeLanguage.label}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <ul
          role="listbox"
          className={`absolute right-0 z-30 min-w-[150px] w-[190px] max-w-[calc(100vw-40px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:min-w-[180px] sm:w-[220px] ${menuPositionClass}`}
        >
          {LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                onClick={(event) => changeLanguage(lang.code, event)}
                className={`flex w-full flex-nowrap items-center gap-2 whitespace-nowrap px-2.5 py-2 text-left text-xs transition sm:px-3 sm:text-sm ${
                  active === lang.code
                    ? "bg-indigo-600 text-white"
                    : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                <span
                  className={`inline-flex h-5 min-w-7 items-center justify-center rounded-md px-1 text-[10px] font-bold tracking-wide ${
                    active === lang.code ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {lang.badge}
                </span>
                <span
                  className="wc-lang-label block whitespace-nowrap"
                  data-lang={lang.code}
                  style={
                    lang.code === "km"
                      ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                      : undefined
                  }
                >
                  {lang.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default LanguageSwitcher;
