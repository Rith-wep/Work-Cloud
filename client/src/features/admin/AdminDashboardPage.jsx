import { useEffect, useState } from "react";
import { useAuth } from "../../shared/context/AuthContext.jsx";

function AdminDashboardPage() {
  const { token } = useAuth(); const [stats, setStats] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"}/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => r.json()).then((data) => { if (active) setStats(data.stats || data); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, [token]);
  const cards = Object.entries(stats || {}).filter(([, value]) => typeof value === "number");
  return <section className="space-y-6"><div><h1 className="text-2xl font-bold text-slate-100">Admin dashboard</h1><p className="mt-1 text-sm text-slate-400">Platform overview</p></div>{error && <p role="alert" className="text-sm text-rose-400">{error}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value]) => <article key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm capitalize text-slate-400">{label.replace(/([A-Z])/g," $1")}</p><p className="mt-2 text-3xl font-bold text-white">{value.toLocaleString()}</p></article>)}</div></section>;
}
export default AdminDashboardPage;

