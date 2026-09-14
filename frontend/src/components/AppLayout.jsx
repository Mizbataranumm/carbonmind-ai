import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Activity, Sparkles, Users, Leaf, Bell, TrendingUp, ScanLine, Award, X, Circle, Menu, Sun, Moon, Gamepad2 } from "lucide-react";
import { useUser } from "@/lib/UserContext";
import { Plus } from "lucide-react";
import { getCarbonStats } from "@/lib/api";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/predict", label: "Plan today", icon: TrendingUp, testid: "nav-predict" },
  { to: "/scan", label: "Food Scanner", icon: ScanLine, testid: "nav-scan" },
  { to: "/tracker", label: "Activity history", icon: Activity, testid: "nav-tracker" },
  { to: "/future", label: "Future scenarios", icon: Sparkles, testid: "nav-future" },
  { to: "/community", label: "Community", icon: Users, testid: "nav-community" },
  { to: "/challenges", label: "Challenges", icon: Award, testid: "nav-challenges" },
  { to: "/certificate", label: "Certificate", icon: Award, testid: "nav-certificate" },
  { to: "/game", label: "Eco Mini-Game", icon: Gamepad2, testid: "nav-game" },
];

const AppLayout = () => {
  const { user, setUser, theme, toggleTheme } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = Boolean(user?.is_demo);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() => (
    typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported"
  ));

  useEffect(() => {
    if (!user?.id) {
      setStats(null);
      return;
    }
    getCarbonStats(user.id).then(setStats).catch(() => setStats(null));
  }, [user?.id]);

  const notifications = useMemo(() => {
    if (!stats) return [];
    const todayKg = Number(stats.today_kg || 0);
    if (todayKg <= 0) {
      return [{
        id: "activity-needed",
        title: "No activities saved today",
        body: "Add a completed activity or confirm a scanned meal to begin today’s record.",
        tag: "record",
        time: "Today",
        unread: true,
      }];
    }
    if (todayKg > 6.5) {
      return [{
        id: "budget-crossed",
        title: "Daily budget crossed",
        body: `${todayKg.toFixed(1)} kg CO2e is saved today, above your 6.5 kg budget.`,
        tag: "budget",
        time: "Today",
        unread: true,
      }];
    }
    return [{
      id: "record-updated",
      title: "Today’s record is up to date",
      body: `${todayKg.toFixed(1)} kg CO2e is saved today. ${Math.max(0, 6.5 - todayKg).toFixed(1)} kg remains within your daily budget.`,
      tag: "record",
      time: "Today",
      unread: false,
    }];
  }, [stats]);

  useEffect(() => {
    if (notificationPermission !== "granted" || !user?.id || !notifications.length) return;
    const key = `cm_browser_alert_${user.id}_${new Date().toISOString().slice(0, 10)}`;
    const current = notifications[0];
    const signature = `${current.id}:${current.body}`;
    if (localStorage.getItem(key) === signature) return;
    new window.Notification(current.title, { body: current.body });
    localStorage.setItem(key, signature);
  }, [notificationPermission, notifications, user?.id]);

  const enableBrowserAlerts = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
  };

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-app text-main overflow-x-hidden">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] hidden lg:flex flex-col p-6 border-r border-glass-border bg-app/70 backdrop-blur-xl z-30 overflow-y-auto" data-testid="sidebar">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#00FFB2,#00D9FF)', boxShadow: '0 0 20px rgba(0,255,178,0.35)' }}>
              <Leaf className="h-5 w-5" style={{ color: '#071014' }} strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green border-2"
                    style={{ borderColor: 'var(--app-bg)', boxShadow: '0 0 8px #00FFB2' }} />
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none" style={{ color: 'var(--text-primary)' }}>CarbonMind</div>
              <div className="font-mono-data text-[9px] uppercase tracking-[0.15em] mt-1" style={{ color: 'var(--neon-green)' }}>
                {isDemo ? "Demo workspace" : "Personal carbon record"}
              </div>
            </div>
          </div>
          <div className="mt-3 h-px" style={{ background: 'linear-gradient(90deg,rgba(0,255,178,0.3),transparent)' }} />
          {isDemo && (
            <div className="mt-3 px-3 py-2 rounded-xl border border-cyan/25 bg-cyan/5">
              <p className="font-mono-data text-[9px] uppercase tracking-widest text-cyan">Demo account</p>
              <p className="mt-1 text-[11px] leading-relaxed text-secondary">Explore the sample data, then create an account for your own record.</p>
            </div>
          )}
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
              <p className="text-[10px] text-secondary truncate font-mono-data">{isDemo ? "Demo sample account" : "Private activity profile"}</p>
            </div>
            {isDemo && <span className="rounded-full border border-green/25 bg-green/10 px-2 py-1 text-[9px] font-mono-data uppercase tracking-widest text-green">Demo</span>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-[260px] min-h-screen overflow-x-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-20 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex items-center justify-between bg-app/70 backdrop-blur-xl border-b border-glass-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-9 w-9 rounded-lg border border-glass-border flex items-center justify-center hover:bg-widget"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-main" />
            </button>
            <div className="hidden lg:flex h-9 w-9 rounded-lg items-center justify-center overflow-visible">
              <div className="hidden lg:flex h-8 w-8 rounded-lg bg-gradient-to-br from-green to-cyan items-center justify-center">
              <Leaf className="h-4 w-4 text-[#071014]" strokeWidth={2.5} />
            </div>
            </div>
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">CarbonMind</div>
              <div className="font-display text-lg sm:text-xl">{getTitle(location.pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 font-mono-data text-[10px] uppercase tracking-widest text-cyan">
                Demo mode
              </span>
            )}
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
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4 text-secondary" />
              {notifications.some((notification) => notification.unread) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-green" />}
            </button>
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
                      <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green to-cyan flex items-center justify-center">
                      <Leaf className="h-4.5 w-4.5 text-[#071014]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="font-display font-bold text-lg leading-none">CarbonMind</div>
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mt-0.5">Personal carbon tracker</div>
                    </div>
                  </div>
                    </div>
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
                className="fixed right-4 sm:right-6 top-16 z-40 w-[calc(100vw-2rem)] sm:w-[360px] glass p-4 max-h-[70vh] overflow-y-auto"
                data-testid="notifications-panel"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Alerts</div>
                    <div className="font-display text-base">Notifications</div>
                  </div>
                  <button onClick={() => setNotifOpen(false)} className="h-6 w-6 rounded-md bg-widget hover:bg-widget-hover flex items-center justify-center">
                    <X className="h-3 w-3 text-secondary" />
                  </button>
                </div>
                <div className="space-y-2">
                  {notifications.length ? notifications.map(n => (
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
                  )) : <p className="py-8 text-center text-sm text-secondary">Your saved record will create relevant alerts here.</p>}
                </div>
                <div className="mt-4 border-t border-glass-border pt-4">
                  {notificationPermission === "granted" ? (
                    <p className="text-xs leading-relaxed text-secondary">Browser alerts are enabled while this site is open. Background push alerts require an installed app and a server-side notification service.</p>
                  ) : notificationPermission === "unsupported" ? (
                    <p className="text-xs leading-relaxed text-secondary">This browser does not support system notifications.</p>
                  ) : notificationPermission === "denied" ? (
                    <p className="text-xs leading-relaxed text-secondary">Browser alerts are blocked. You can allow them in your browser site settings.</p>
                  ) : (
                    <button type="button" onClick={enableBrowserAlerts} className="w-full rounded-xl border border-green/30 bg-green/10 px-3 py-2.5 text-sm font-semibold text-green transition hover:bg-green/15">Enable browser alerts</button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="px-4 sm:px-6 lg:px-10 py-5 sm:py-8 pb-24 lg:pb-8">
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
    "/tracker": "Activity History",
    "/predict": "Plan Today",
    "/future": "Future Scenarios",
    "/scan": "Food Carbon Scanner",
    "/certificate": "Verified Certificate",
    "/community": "Eco Community",
    "/profile": "My Profile",
  };
  return map[path] || "CarbonMind";
};

export default AppLayout;
