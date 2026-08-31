import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bell, Shield, LogOut, Award, Flame, Leaf, Camera, X, Check, Phone, HelpCircle } from "lucide-react";
import { useUser } from "@/lib/UserContext";

// ── 16 preset avatars cropped from the official avatar sheet ─────────────
const PRESET_AVATARS = [
  { id: "sofia",     src: "/avatars/avatar_sofia.png",     label: "Sofia" },
  { id: "ben",       src: "/avatars/avatar_ben.png",       label: "Ben" },
  { id: "chloe",     src: "/avatars/avatar_chloe.png",     label: "Chloe" },
  { id: "david",     src: "/avatars/avatar_david.png",     label: "David" },
  { id: "noah",      src: "/avatars/avatar_noah.png",      label: "Noah" },
  { id: "emily",     src: "/avatars/avatar_emily.png",     label: "Emily" },
  { id: "james",     src: "/avatars/avatar_james.png",     label: "James" },
  { id: "female",    src: "/avatars/avatar_female.png",    label: "Alex" },
  { id: "sarah",     src: "/avatars/avatar_sarah.png",     label: "Sarah" },
  { id: "lucas",     src: "/avatars/avatar_lucas.png",     label: "Lucas" },
  { id: "olivia",    src: "/avatars/avatar_olivia.png",    label: "Olivia" },
  { id: "ethan",     src: "/avatars/avatar_ethan.png",     label: "Ethan" },
  { id: "ava",       src: "/avatars/avatar_ava.png",       label: "Ava" },
  { id: "liam",      src: "/avatars/avatar_liam.png",      label: "Liam" },
  { id: "charlotte", src: "/avatars/avatar_charlotte.png", label: "Charlotte" },
  { id: "leo",       src: "/avatars/avatar_leo.png",       label: "Leo" },
];

// ── Avatar Picker modal ───────────────────────────────────────────────────
function AvatarPickerModal({ current, onSelect, onClose }) {
  const [hovered, setHovered] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="border border-glass-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
        style={{ background: "var(--bg-secondary)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-0.5">// Choose Avatar</div>
            <div className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
              Pick Your Look
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl bg-widget border border-glass-border flex items-center justify-center hover:bg-widget-hover transition-colors">
            <X className="h-4 w-4 text-secondary" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-3">
          {PRESET_AVATARS.map(av => {
            const isSelected = current === av.src;
            return (
              <button
                key={av.id}
                onClick={() => { onSelect(av.src); onClose(); }}
                onMouseEnter={() => setHovered(av.id)}
                onMouseLeave={() => setHovered(null)}
                className="relative group flex flex-col items-center gap-1.5 focus:outline-none"
              >
                <div className={`relative h-16 w-16 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-green shadow-[0_0_16px_rgba(0,255,178,0.5)] scale-105"
                    : hovered === av.id
                      ? "border-cyan/60 scale-105"
                      : "border-glass-border"
                }`}>
                  <img
                    src={av.src}
                    alt={av.label}
                    className="w-full h-full object-cover"
                    style={{ background: "var(--glass-bg)" }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-green/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green drop-shadow" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Upload own */}
        <div className="mt-5 pt-4 border-t border-glass-border">
          <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-glass-border text-sm font-medium text-secondary hover:text-main hover:border-green/40 hover:bg-green/5 transition-all cursor-pointer">
            <Camera className="h-4 w-4" />
            Upload your own photo
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => { onSelect(ev.target.result); onClose(); };
              reader.readAsDataURL(file);
            }} />
          </label>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Profile Page ─────────────────────────────────────────────────────
const Profile = () => {
  const { user, setUser } = useUser();
  const [pushNotifs, setPushNotifs] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!user) return null;

  const handleAvatarSelect = (src) => {
    setUser({ ...user, avatar: src });
  };

  const isNewUser = user?.xp === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {pickerOpen && (
          <AvatarPickerModal
            current={user.avatar}
            onSelect={handleAvatarSelect}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Profile Hero Card ─────────────────────────────────────────── */}
      <div className="glass p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-green/20 to-transparent" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with click-to-change */}
          <div className="relative group">
            <button
              onClick={() => setPickerOpen(true)}
              className="relative h-28 w-28 rounded-full focus:outline-none"
              aria-label="Change avatar"
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="h-28 w-28 rounded-full object-cover border-4 group-hover:brightness-75 transition-all"
                style={{ borderColor: "var(--app-bg)", background: "var(--glass-bg)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <div className="flex flex-col items-center gap-1">
                  <Camera className="h-7 w-7 text-white drop-shadow-lg" />
                  <span className="text-white text-[10px] font-bold drop-shadow">Change</span>
                </div>
              </div>
            </button>

            {/* Rotating ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
              className="absolute -inset-2 rounded-full border border-dashed border-green/40 pointer-events-none"
            />

            {/* Carbon aura dot */}
            <div
              className="absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-app z-20"
              style={{ background: user.carbon_aura, boxShadow: `0 0 15px ${user.carbon_aura}` }}
            />
          </div>

          {/* Name & grade */}
          <div className="flex-1 text-center sm:text-left mt-2">
            <h1 className="font-display text-3xl font-bold">{user.name}</h1>
            <div className="font-mono-data text-secondary mt-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20 text-xs">
                Grade {user.grade}
              </span>
              <span>· {user.xp} XP</span>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="mt-3 text-xs font-mono-data text-cyan px-3 py-1.5 rounded-lg bg-cyan/10 hover:bg-cyan/20 border border-cyan/20 transition-all"
            >
              ✏ Change Avatar
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-glass-border">
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Flame className="h-5 w-5 text-[#FFD166]" />
            </div>
            <div className="font-mono-data text-xl font-bold">{user.streak ?? 0}</div>
            <div className="text-xs text-secondary mt-1">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Award className="h-5 w-5 text-cyan" />
            </div>
            <div className="font-mono-data text-xl font-bold">{isNewUser ? 0 : 12}</div>
            <div className="text-xs text-secondary mt-1">Badges</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Leaf className="h-5 w-5 text-green" />
            </div>
            <div className="font-mono-data text-xl font-bold">
              {isNewUser ? "0.0" : "8.4"}<span className="text-xs">kg</span>
            </div>
            <div className="text-xs text-secondary mt-1">Daily Avg</div>
          </div>
        </div>
      </div>

      {/* ── Preset Avatars quick-select strip ──────────────────────────── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-0.5">// Avatar Gallery</div>
            <div className="font-display font-bold text-base" style={{ color: "var(--text-primary)" }}>Choose your character</div>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 border border-green/20 transition-all"
          >
            See all →
          </button>
        </div>

        {/* Scrollable row of avatars */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {PRESET_AVATARS.map(av => {
            const isSelected = user.avatar === av.src;
            return (
              <button
                key={av.id}
                onClick={() => handleAvatarSelect(av.src)}
                className="flex-shrink-0 relative group"
                title={av.label}
              >
                <div className={`h-14 w-14 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-green shadow-[0_0_14px_rgba(0,255,178,0.5)] scale-110"
                    : "border-glass-border hover:border-cyan/50 hover:scale-110"
                }`}>
                  <img
                    src={av.src}
                    alt={av.label}
                    className="w-full h-full object-cover"
                    style={{ background: "var(--glass-bg)" }}
                  />
                </div>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green flex items-center justify-center border-2 border-app">
                    <Check className="h-3 w-3 text-app" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Settings & Account ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="font-display text-xl ml-2">Preferences</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <SettingRow
              icon={Bell}
              title="Push Notifications"
              desc="Alerts for streaks and limits"
              active={pushNotifs}
              onClick={() => setPushNotifs(!pushNotifs)}
            />
            <SettingRow
              icon={Shield}
              title="Private Profile"
              desc="Hide stats from community leaderboard"
              active={isPrivate}
              onClick={() => setIsPrivate(!isPrivate)}
            />
            <SettingRow
              icon={Camera}
              title="Change Avatar"
              desc="Pick from presets or upload your own"
              action={
                <button
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 transition"
                >
                  Open Picker
                </button>
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-xl ml-2">Account</h2>
          <div className="glass rounded-2xl overflow-hidden p-6 text-center space-y-4">
            <p className="text-sm text-secondary">
              Signed in as{" "}
              <strong className="text-main">{user.name}</strong>.{" "}
              All data is stored securely.
            </p>
            {/* Help / How to use app */}
            <div className="text-left p-3 rounded-xl bg-cyan/5 border border-cyan/20 text-xs text-secondary space-y-1">
              <div className="flex items-center gap-2 text-cyan font-bold text-xs mb-2">
                <HelpCircle className="h-4 w-4" /> How to use CarbonMind AI
              </div>
              <div>📷 <strong>Scan Food</strong> — photograph any meal to log its CO₂</div>
              <div>📊 <strong>Daily Forecaster</strong> — predict today's total emissions</div>
              <div>📡 <strong>Live Tracker</strong> — log transport, energy, devices</div>
              <div>🔮 <strong>10-Year Simulator</strong> — see your future carbon trajectory</div>
              <div>🤖 <strong>AI Coach</strong> — tap the green bot icon for personalized tips</div>
              <div>📞 <strong>Call Me</strong> — get an automated phone briefing of your stats</div>
            </div>
            <button
              onClick={() => { setUser(null); window.location.href = "/"; }}
              className="btn-ghost w-full flex items-center justify-center gap-2 !text-red-400 hover:!bg-red-400/10 hover:!border-red-400/30"
            >
              <LogOut className="h-4 w-4" /> Sign out completely
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingRow = ({ icon: Icon, title, desc, active, action, onClick }) => (
  <div className="flex items-center justify-between p-4 border-b border-glass-border last:border-0 hover:bg-widget transition">
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-widget flex items-center justify-center border border-glass-border">
        <Icon className="h-5 w-5 text-secondary" />
      </div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-secondary mt-0.5">{desc}</div>
      </div>
    </div>
    {action ? (
      typeof action === "string" ? (
        <button className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 transition">
          {action}
        </button>
      ) : action
    ) : (
      <div
        onClick={onClick}
        className={`h-6 w-11 rounded-full p-1 transition-colors cursor-pointer ${
          active ? "bg-green" : "bg-widget border border-glass-border"
        }`}
      >
        <div className={`h-4 w-4 rounded-full bg-white transition-transform ${active ? "translate-x-5" : "translate-x-0 bg-secondary"}`} />
      </div>
    )}
  </div>
);

export default Profile;
