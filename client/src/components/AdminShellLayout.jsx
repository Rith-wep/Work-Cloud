import { BarChart3, BriefcaseBusiness, FolderKanban, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { isSuperAdmin } from "../utils/admin.js";

const navigationItems = [
  {
    to: "/",
    label: "Overview",
    icon: LayoutDashboard,
    minimumRole: "moderator",
  },
  {
    to: "/users",
    label: "User Management",
    icon: Users,
    minimumRole: "super_admin",
  },
  {
    to: "/jobs",
    label: "Job Moderation",
    icon: BriefcaseBusiness,
    minimumRole: "super_admin",
  },
  {
    to: "/catalog",
    label: "Catalog Admin",
    icon: FolderKanban,
    minimumRole: "moderator",
  },
  {
    to: "/audit-logs",
    label: "System Audit Logs",
    icon: ShieldCheck,
    minimumRole: "super_admin",
  },
];

function AdminShellLayout() {
  const { logout, user } = useAuth();
  const superAdmin = isSuperAdmin(user);
  const visibleItems = navigationItems.filter((item) =>
    item.minimumRole === "moderator" ? true : superAdmin
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-800 bg-slate-950 px-5 py-6 text-slate-100 lg:flex">
          <div>
            <div
              className="inline-flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-slate-900 px-4 py-3"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-300">
                <BarChart3 size={22} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">WorkCloud</p>
                <p className="text-lg font-bold text-white">Admin Console</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Signed In</p>
              <p className="mt-2 text-sm font-semibold text-white">{user?.name || user?.email}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
              <span className="mt-3 inline-flex rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                {String(user?.adminRole || "admin").replace("_", " ")}
              </span>
            </div>
          </div>

          <nav className="mt-8 flex-1 space-y-2">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/40"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white",
                    ].join(" ")
                  }
                  style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-700 hover:text-white"
          >
            Sign Out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
                  admin.workcloud.com
                </p>
                <h1 className="text-xl font-bold text-slate-900">Super Admin Dashboard</h1>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{user?.name || "Admin"}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {String(user?.adminRole || "admin").replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminShellLayout;
