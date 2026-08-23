import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Activity, Sparkles, Users, LogOut, Leaf, Bell, TrendingUp, ScanLine, Award, X, Circle, Menu, Sun, Moon, Gamepad2, BrainCircuit } from "lucide-react";
import { useUser } from "@/lib/UserContext";
import VoiceCallModal from "./VoiceCallModal";
import FloatingAICoach from "./FloatingAICoach";
import { Plus } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/predict", label: "Daily Forecaster", icon: TrendingUp, testid: "nav-predict" },
  { to: "/scan", label: "Food Scanner", icon: ScanLine, testid: "nav-scan" },
  { to: "/tracker", label: "Live Tracker", icon: Activity, testid: "nav-tracker" },
  { to: "/future", label: "10-Year Simulator", icon: Sparkles, testid: "nav-future" },
  { to: "/community", label: "Community", icon: Users, testid: "nav-community" },
  { to: "/challenges", label: "Challenges", icon: Award, testid: "nav-challenges" },
  { to: "/certificate", label: "Certificate", icon: Award, testid: "nav-certificate" },
  { to: "/game", label: "Eco Mini-Game", icon: Gamepad2, testid: "nav-game" },
];

const demoNotifications = [
  { id: 1, title: "Weekly briefing ready", body: "Your AI coach is waiting on the dashboard.", tag: "AI", time: "just now", unread: true },
  { id: 2, title: "New challenge: No-AC Week", body: "421 eco-citizens have joined - 3 days left.", tag: "Community", time: "1h", unread: true },
  { id: 3, title: "Streak milestone!", body: "14 days below your daily target. Legendary.", tag: "Reward", time: "5h", unread: false },
  { id: 4, title: "Prediction alert", body: "Morning transport was above baseline. Consider cycling.", tag: "Predict", time: "1d", unread: false },
];

const AppLayout = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    // Default to light theme
    document.documentElement.setAttribute("data-theme", "light");
    return "light";
  });
  
  const isNew = user?.xp === 0;
  
  const [notifs, setNotifs] = useState(() => {
    if (isNew) {
      return [
        { id: 1, title: "Welcome to CarbonMind!", body: "We're thrilled to have you here. Start tracking your footprint.", tag: "System", time: "just now", unread: true },
        { id: 2, title: "Action Required", body: "Scan your first meal to initialize your Carbon DNA.", tag: "Onboarding", time: "1m", unread: true }
      ];
    }
    return demoNotifications;
  });
  
  const unreadCount = notifs.filter(n => n.unread).length;

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  if (!user) return null;

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const markAllRead = () => setNotifs(notifs.map(n => ({ ...n, unread: false })));

  return (
    <div className="min-h-screen flex bg-app text-main overflow-x-hidden">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] hidden lg:flex flex-col p-6 border-r border-glass-border bg-app/70 backdrop-blur-xl z-30 overflow-y-auto" data-testid="sidebar">
        <div className="mb-8">
          <div className="flex flex-col items-start gap-0.5">
            <div className="relative inline-flex w-[160px]">
              <img src="/carbonmind-logo2-transparent.png" alt="CarbonMind" className="w-full h-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all" />
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-green border-2 border-app"
                    style={{ boxShadow: '0 0 8px #00FFB2' }} />
            </div>
            <div className="font-mono-data text-[9px] uppercase tracking-[0.15em] ml-2 font-bold" style={{ color: 'var(--neon-green)' }}>AI · v1.0 · Live</div>
          </div>
          <div className="mt-3 h-px" style={{ background: 'linear-gradient(90deg,rgba(0,255,178,0.3),transparent)' }} />
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
                    ? "bg-widget text-main border border-green/20"
                    : "text-secondary hover:text-main hover:bg-widget border border-transparent"
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
                      className="absolute right-3 h-1.5 w-1.5 rounded-full bg-green"
                      style={{ boxShadow: "0 0 12px var(--neon-green)" }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-glass-border">
          <div
            onClick={() => navigate("/profile")}
            className="group flex items-center gap-3 p-2 rounded-2xl hover:bg-glass-hover-bg transition-colors cursor-pointer"
          >
            <div className="relative">
              <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full bg-panel object-cover border border-glass-border" />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green rounded-full flex items-center justify-center border-2 border-app text-app opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-3 w-3" />
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-app group-hover:opacity-0 transition-opacity"
                style={{ background: user.carbon_aura, boxShadow: `0 0 10px ${user.carbon_aura}` }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate text-main group-hover:text-green transition-colors">{user.name}</p>
              <p className="text-[10px] text-secondary truncate font-mono-data">Grade {user.grade} · {user.xp} XP</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-[260px] min-h-screen overflow-x-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-20 px-6 lg:px-10 py-4 flex items-center justify-between bg-app/70 backdrop-blur-xl border-b border-glass-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-9 w-9 rounded-lg border border-glass-border flex items-center justify-center hover:bg-widget"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-main" />
            </button>
            <div className="hidden lg:flex h-9 w-9 rounded-lg items-center justify-center overflow-visible">
              <img src="/carbonmind-logo2-transparent.png" alt="CarbonMind Logo" className="w-full h-full object-contain scale-[1.4] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
            </div>
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">Live Dashboard</div>
              <div className="font-display text-lg sm:text-xl">{getTitle(location.pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full bg-widget border border-glass-border flex items-center justify-center hover:bg-widget-hover transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-secondary" /> : <Moon className="h-4 w-4 text-secondary" />}
            </button>
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative h-9 w-9 rounded-full bg-widget border border-glass-border flex items-center justify-center hover:bg-widget-hover transition"
              data-testid="notifications-btn"
            >
              <Bell className="h-4 w-4 text-secondary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-green text-app text-[9px] font-mono-data font-bold flex items-center justify-center" style={{ boxShadow: "0 0 8px var(--neon-green)" }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-glass-border">
              <div className="text-right">
                <div className="font-mono-data text-[10px] text-secondary">Streak</div>
                <div className="font-mono-data text-sm text-green">{user.streak} days</div>
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
                className="fixed inset-0 z-40 bg-app/80 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-[260px] flex flex-col p-6 border-r border-glass-border lg:hidden"
                style={{ background: "var(--app-bg)" }}
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="relative inline-flex w-[140px]">
                      <img src="/carbonmind-logo2-transparent.png" alt="CarbonMind" className="w-full h-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                    </div>
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-green ml-2 font-bold">AI · v1.0</div>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-widget">
                    <X className="h-5 w-5 text-secondary" />
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
                            ? "bg-widget text-main border border-green/20"
                            : "text-secondary hover:text-main hover:bg-widget border border-transparent"
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
                              className="absolute right-3 h-1.5 w-1.5 rounded-full bg-green"
                              style={{ boxShadow: "0 0 12px var(--neon-green)" }}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                  <NavLink
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all mt-4 ${
                        isActive
                          ? "bg-widget text-main border border-green/20"
                          : "text-secondary hover:text-main hover:bg-widget border border-transparent"
                      }`
                    }
                  >
                    <Users className="h-4 w-4" />
                    <span className="font-medium">My Profile</span>
                  </NavLink>
                </nav>
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
                className="fixed inset-0 z-30 bg-app/40"
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
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Alerts</div>
                    <div className="font-display text-base">Notifications</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={markAllRead} className="font-mono-data text-[10px] text-green hover:underline" data-testid="mark-read-btn">Mark all read</button>
                    <button onClick={() => setNotifOpen(false)} className="h-6 w-6 rounded-md bg-widget hover:bg-widget-hover flex items-center justify-center">
                      <X className="h-3 w-3 text-secondary" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {notifs.map(n => (
                    <div key={n.id} className={`p-3 rounded-xl border ${n.unread ? "bg-green/5 border-green/20" : "bg-widget border-glass-border"}`} data-testid={`notif-${n.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {n.unread && <Circle className="h-2 w-2 fill-green text-green flex-shrink-0" />}
                            <div className="font-medium text-sm truncate">{n.title}</div>
                          </div>
                          <div className="text-xs text-secondary mt-1 leading-relaxed">{n.body}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono-data text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-widget border border-glass-border text-secondary">{n.tag}</span>
                          <div className="font-mono-data text-[10px] text-muted mt-1">{n.time}</div>
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
              <FloatingAICoach />
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
    "/profile": "My Profile",
  };
  return map[path] || "CarbonMind";
};

export default AppLayout;
