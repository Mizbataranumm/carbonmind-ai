import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Activity, Sparkles, Users, LogOut, Leaf, Bell } from "lucide-react";
import { useUser } from "@/lib/UserContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/tracker", label: "Live Tracker", icon: Activity, testid: "nav-tracker" },
  { to: "/future", label: "Future Simulator", icon: Sparkles, testid: "nav-future" },
  { to: "/community", label: "Community", icon: Users, testid: "nav-community" },
];

const AppLayout = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => {
    setUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-[#071014] text-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] hidden lg:flex flex-col p-6 border-r border-white/[0.06] bg-[#071014]/70 backdrop-blur-xl z-30" data-testid="sidebar">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] flex items-center justify-center">
            <Leaf className="h-4.5 w-4.5 text-[#071014]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">CarbonMind</div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2] mt-0.5">AI · v1.0</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  isActive
                    ? "bg-white/[0.04] text-white border border-[#00FFB2]/20"
                    : "text-[#9EABBC] hover:text-white hover:bg-white/[0.03] border border-transparent"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[#00FFB2]"
                      style={{ boxShadow: "0 0 12px #00FFB2" }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="glass p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full bg-[#0d1f27] border border-white/10" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#071014]"
                  style={{ background: user.carbon_aura, boxShadow: `0 0 10px ${user.carbon_aura}` }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{user.name}</div>
                <div className="font-mono-data text-[10px] text-[#9EABBC]">Grade {user.grade} · {user.xp} XP</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="mt-3 w-full text-xs flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[#9EABBC] hover:text-white transition-all border border-white/5"
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-[260px] min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 px-6 lg:px-10 py-4 flex items-center justify-between bg-[#071014]/70 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="lg:hidden h-8 w-8 rounded-lg bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] flex items-center justify-center">
              <Leaf className="h-4 w-4 text-[#071014]" />
            </div>
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">Live Dashboard</div>
              <div className="font-display text-lg sm:text-xl">{getTitle(location.pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/[0.08] transition" data-testid="notifications-btn">
              <Bell className="h-4 w-4 text-[#9EABBC]" />
            </button>
            <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-white/10">
              <div className="text-right">
                <div className="font-mono-data text-[10px] text-[#9EABBC]">Streak</div>
                <div className="font-mono-data text-sm text-[#00FFB2]">{user.streak} days</div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 lg:px-10 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const getTitle = (path) => {
  const map = { "/dashboard": "Carbon Overview", "/tracker": "Live Activity Tracker", "/future": "AI Future Simulator", "/community": "Eco Community" };
  return map[path] || "CarbonMind";
};

export default AppLayout;
