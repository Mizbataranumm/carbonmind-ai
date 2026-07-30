import React from "react";
import { motion } from "framer-motion";
import { User, Settings, Bell, Shield, LogOut, Award, Flame, Leaf } from "lucide-react";
import { useUser } from "@/lib/UserContext";

const Profile = () => {
  const { user, setUser } = useUser();

  if (!user) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUser({ ...user, avatar: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="glass p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-green/20 to-transparent" />
        
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <div className="h-28 w-28 rounded-full bg-panel border-4 border-app p-1 z-10 relative">
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
            </div>
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
              className="absolute -inset-2 rounded-full border border-dashed border-green/40 pointer-events-none" 
            />
            <div 
              className="absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-app z-20"
              style={{ background: user.carbon_aura, boxShadow: `0 0 15px ${user.carbon_aura}` }}
            />
          </div>

          <div className="flex-1 text-center sm:text-left mt-2">
            <h1 className="font-display text-3xl font-bold">{user.name}</h1>
            <div className="font-mono-data text-secondary mt-1 flex items-center justify-center sm:justify-start gap-2">
              <span className="px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20 text-xs">
                Grade {user.grade}
              </span>
              <span>· {user.xp} XP</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-glass-border">
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Flame className="h-5 w-5 text-green" />
            </div>
            <div className="font-mono-data text-xl font-bold">{user.streak}</div>
            <div className="text-xs text-secondary mt-1">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Award className="h-5 w-5 text-cyan" />
            </div>
            <div className="font-mono-data text-xl font-bold">12</div>
            <div className="text-xs text-secondary mt-1">Badges</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Leaf className="h-5 w-5 text-green" />
            </div>
            <div className="font-mono-data text-xl font-bold">8.4<span className="text-xs">kg</span></div>
            <div className="text-xs text-secondary mt-1">Daily Avg</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="font-display text-xl ml-2">Preferences</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <SettingRow icon={Bell} title="Push Notifications" desc="Alerts for streaks and limits" active />
            <SettingRow icon={Shield} title="Private Profile" desc="Hide stats from community leaderboard" />
            <SettingRow 
              icon={User} 
              title="Edit Avatar" 
              desc="Change your profile picture" 
              action={
                <label className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 transition cursor-pointer">
                  Upload
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              } 
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-xl ml-2">Account</h2>
          <div className="glass rounded-2xl overflow-hidden p-6 text-center space-y-4">
            <p className="text-sm text-secondary">
              You are signed in as <strong className="text-main">{user.name}</strong>.
              All your data is securely stored and processed locally.
            </p>
            <button 
              onClick={() => { setUser(null); window.location.href = '/'; }}
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

const SettingRow = ({ icon: Icon, title, desc, active, action }) => (
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
      typeof action === 'string' ? (
        <button className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 transition">
          {action}
        </button>
      ) : action
    ) : (
      <div className={`h-6 w-11 rounded-full p-1 transition-colors cursor-pointer ${active ? 'bg-green' : 'bg-widget border border-glass-border'}`}>
        <div className={`h-4 w-4 rounded-full bg-white transition-transform ${active ? 'translate-x-5' : 'translate-x-0 bg-secondary'}`} />
      </div>
    )}
  </div>
);

export default Profile;
