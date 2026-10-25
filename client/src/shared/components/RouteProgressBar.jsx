import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const TRACKED_ROUTES = ["/workspace", "/map", "/profile"];

function RouteProgressBar() {
  const location = useLocation();
  const timersRef = useRef([]);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const matchesTrackedRoute = TRACKED_ROUTES.some((route) =>
      location.pathname.startsWith(route)
    );
    if (!matchesTrackedRoute) {
      return undefined;
    }

    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];

    setVisible(true);
    setProgress(18);

    timersRef.current.push(window.setTimeout(() => setProgress(58), 80));
    timersRef.current.push(window.setTimeout(() => setProgress(82), 180));
    timersRef.current.push(window.setTimeout(() => setProgress(100), 320));
    timersRef.current.push(
      window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 520)
    );

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [location.pathname, location.search]);

  return (
    <div className={`route-progress ${visible ? "route-progress--active" : ""}`} aria-hidden="true">
      <div className="route-progress__bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

export default RouteProgressBar;
