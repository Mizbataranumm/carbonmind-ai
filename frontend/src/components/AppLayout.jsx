import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Activity, Sparkles, Users, LogOut, Leaf, Bell, TrendingUp, ScanLine, Award, X, Circle, Menu } from "lucide-react";
import { useUser } from "@/lib/UserContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/tracker", label: "Live Tracker", icon: Activity, testid: "nav-tracker" },
  { to: "/predict", label: "Predict Day", icon: TrendingUp, testid: "nav-predict" },
  { to: "/future", label: "Future Simulator", icon: Sparkles, testid: "nav-future" },
  { to: "/scan", label: "Food Scanner", icon: ScanLine, testid: "nav-scan" },
  { to: "/certificate", label: "Certificate", icon: Award, testid: "nav-certificate" },
  { to: "/community", label: "Community", icon: Users, testid: "nav-community" },
];

const notifications = [
  { id: 1, title: "Weekly briefing ready", body: "Your AI coach is waiting on the dashboard.", tag: "AI", time: "just now", unread: true },
  { id: 2, title: "New challenge: No-AC Week", body: "421 eco-citizens have joined — 3 days left.", tag: "Community", time: "1h", unread: true },
  { id: 3, title: "Streak milestone!", body: "14 days below your daily target. Legendary.", tag: "Reward", time: "5h", unread: false },
  { id: 4, title: "Prediction alert", body: "Morning transport was above baseline. Consider cycling.", tag: "Predict", time: "1d", unread: false },
];

const AppLayout = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState(notifications);
  const unreadCount = notifs.filter(n => n.unread).length;

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => {
    setUser(null);
    navigate("/");
  };

  const markAllRead = () => setNotifs(notifs.map(n => ({ ...n, unread: false })));

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
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-9 w-9 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/[0.04]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
            <div className="hidden lg:flex h-8 w-8 rounded-lg bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] items-center justify-center">
              <Leaf className="h-4 w-4 text-[#071014]" />
            </div>
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">Live Dashboard</div>
              <div className="font-display text-lg sm:text-xl">{getTitle(location.pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative h-9 w-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/[0.08] transition"
              data-testid="notifications-btn"
            >
              <Bell className="h-4 w-4 text-[#9EABBC]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[#00FFB2] text-[#071014] text-[9px] font-mono-data font-bold flex items-center justify-center" style={{ boxShadow: "0 0 8px #00FFB2" }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-white/10">
              <div className="text-right">
                <div className="font-mono-data text-[10px] text-[#9EABBC]">Streak</div>
                <div className="font-mono-data text-sm text-[#00FFB2]">{user.streak} days</div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-[#071014]/80 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-[260px] flex flex-col p-6 bg-[#0a161c] border-r border-white/[0.06] lg:hidden"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] flex items-center justify-center">
                      <Leaf className="h-4.5 w-4.5 text-[#071014]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="font-display font-bold text-lg leading-none">CarbonMind</div>
                      <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2] mt-0.5">AI · v1.0</div>
                    </div>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5">
                    <X className="h-5 w-5 text-[#9EABBC]" />
                  </button>
                </div>
                
                <nav className="flex flex-col gap-1 overflow-y-auto">
                  {navItems.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
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
                              layoutId="nav-pill-mobile"
                              className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[#00FFB2]"
                              style={{ boxShadow: "0 0 12px #00FFB2" }}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-white/[0.06]">
                  <button
                    onClick={handleLogout}
                    className="w-full text-sm flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-[#9EABBC] hover:text-white transition-all border border-white/5"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Notifications panel */}
        <AnimatePresence>
          {notifOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-[#071014]/40"
                onClick={() => setNotifOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, x: 20, y: -8 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="fixed right-6 top-16 z-40 w-[360px] glass p-4 max-h-[70vh] overflow-y-auto"
                data-testid="notifications-panel"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Alerts</div>
                    <div className="font-display text-base">Notifications</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={markAllRead} className="font-mono-data text-[10px] text-[#00FFB2] hover:underline" data-testid="mark-read-btn">Mark all read</button>
                    <button onClick={() => setNotifOpen(false)} className="h-6 w-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center">
                      <X className="h-3 w-3 text-[#9EABBC]" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {notifs.map(n => (
                    <div key={n.id} className={`p-3 rounded-xl border ${n.unread ? "bg-[#00FFB2]/5 border-[#00FFB2]/20" : "bg-white/[0.02] border-white/[0.05]"}`} data-testid={`notif-${n.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {n.unread && <Circle className="h-2 w-2 fill-[#00FFB2] text-[#00FFB2] flex-shrink-0" />}
                            <div className="font-medium text-sm truncate">{n.title}</div>
                          </div>
                          <div className="text-xs text-[#9EABBC] mt-1 leading-relaxed">{n.body}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono-data text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[#9EABBC]">{n.tag}</span>
                          <div className="font-mono-data text-[10px] text-[#5C6B7A] mt-1">{n.time}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

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
  const map = {
    "/dashboard": "Carbon Overview",
    "/tracker": "Live Activity Tracker",
    "/predict": "Predictive Budget Alert",
    "/future": "AI Future Simulator",
    "/scan": "Food Carbon Scanner",
    "/certificate": "Verified Certificate",
    "/community": "Eco Community",
  };
  return map[path] || "CarbonMind";
};

export default AppLayout;
