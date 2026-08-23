import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { Car, Zap, Utensils, Monitor, Bike, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { getTrackerLive } from "@/lib/api";
import { useUser } from "@/lib/UserContext";

const iconMap = { car: Car, zap: Zap, utensils: Utensils, monitor: Monitor, bike: Bike };

const Tracker = () => {
  const { user } = useUser();
  const isNew = user?.xp === 0;
  const [data, setData] = useState(null);

  useEffect(() => {
    getTrackerLive(isNew).then(setData);
  }, [isNew]);

  if (!data) return <div className="font-mono-data text-secondary">Connecting to sensors...</div>;

  return (
    <div className="space-y-6" data-testid="tracker-root">
      {/* Live header */}
      <div className="glass p-6 glass-hover">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Live telemetry · 24h</div>
            <div className="font-display text-2xl mt-1">Real-time emissions</div>
            <p className="text-sm text-secondary mt-1">Granular per-activity carbon attribution.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green/10 border border-green/25">
            <span className="h-2 w-2 rounded-full bg-green animate-pulse" style={{ boxShadow: "0 0 10px #00FFB2" }} />
            <span className="font-mono-data text-xs text-green">streaming live</span>
          </div>
        </div>
        <div className="h-[230px] mt-5">
          <ResponsiveContainer>
            <AreaChart data={data.realtime} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="rtg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--neon-green)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
              <Area type="monotone" dataKey="kg" stroke="var(--neon-green)" strokeWidth={2.5} fill="url(#rtg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="category-grid">
        {data.categories.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass glass-hover p-5"
          >
            <div className="flex items-center justify-between">
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">{c.name}</div>
              <span className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
            </div>
            <div className="font-mono-data text-3xl mt-2" style={{ color: c.color }}>{c.kg}<span className="text-sm text-secondary ml-1">kg</span></div>
            <div className="text-xs text-secondary mt-1">Budget {c.budget} kg</div>
            <div className="h-1 w-full bg-widget rounded-full mt-3 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (c.kg / c.budget) * 100)}%` }} transition={{ duration: 1.2 }} className="h-full" style={{ background: c.color }} />
            </div>
            <div className={`flex items-center gap-1 text-xs font-mono-data mt-3 ${c.trend <= 0 ? "text-green" : "text-[#FFD166]"}`}>
              {c.trend <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {c.trend === 0 ? "flat" : `${c.trend > 0 ? "+" : ""}${c.trend} kg`}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity feed + heatmap */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="glass p-6 glass-hover lg:col-span-2" data-testid="activity-feed">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Activity feed</div>
              <div className="font-display text-xl mt-1">Today</div>
            </div>
            <Activity className="h-4 w-4 text-cyan" />
          </div>
          <div className="space-y-2">
            {data.activities.map((a) => {
              const Icon = iconMap[a.icon] || Car;
              return (
                <motion.div
                  key={a.id}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-4 p-3.5 rounded-xl bg-widget border border-white/[0.04] hover:border-green/20 transition"
                >
                  <div className="h-9 w-9 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-green" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{a.label}</div>
                    <div className="font-mono-data text-[11px] text-secondary">{a.time} · {a.type}</div>
                  </div>
                  <div className="font-mono-data text-base text-main">{a.kg.toFixed(1)} kg</div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Heatmap */}
        <div className="glass p-6 glass-hover" data-testid="heatmap-card">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// 8-week heatmap</div>
          <div className="font-display text-xl mt-1">Carbon density</div>
          <div className="grid grid-cols-7 gap-1.5 mt-4">
            {Array.from({ length: 56 }).map((_, i) => {
              const intensity = Math.random();
              const color = `rgba(0,255,178,${0.08 + intensity * 0.55})`;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.008, duration: 0.3 }}
                  className="aspect-square rounded-sm"
                  style={{ background: color, boxShadow: intensity > 0.7 ? "0 0 8px rgba(0,255,178,0.4)" : "none" }}
                  title={`Day ${i + 1}: ${(intensity * 10).toFixed(1)} kg`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4 text-[10px] font-mono-data text-secondary">
            <span>Less</span>
            <div className="flex gap-1">
              {[0.1, 0.25, 0.4, 0.55, 0.7].map((v, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgba(0,255,178,${v})` }} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tracker;
