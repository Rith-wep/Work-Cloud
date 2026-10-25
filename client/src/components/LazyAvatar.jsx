import { useMemo, useState } from "react";

function LazyAvatar({
  src = "",
  alt = "",
  name = "",
  className = "h-10 w-10",
  textClassName = "text-sm",
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const normalizedSrc = useMemo(() => {
    const raw = String(src || "").trim();
    if (!raw) {
      return "";
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
    }
    return raw;
  }, [src]);

  const fallbackInitial = String(name || "N").charAt(0).toUpperCase();
  const showImage = Boolean(normalizedSrc) && !failed;

  return (
    <div className={`${className} overflow-hidden rounded-full bg-slate-200`}>
      {!showImage || !loaded ? (
        <div className="flex h-full w-full items-center justify-center">
          <span className={`font-bold text-slate-600 ${textClassName}`}>{fallbackInitial}</span>
        </div>
      ) : null}
      {showImage ? (
        <img
          src={normalizedSrc}
          alt={alt || name || "Avatar"}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
    </div>
  );
}

export default LazyAvatar;
