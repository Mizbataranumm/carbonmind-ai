import React, { useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { AlertTriangle, TreePine, Car, Zap, Utensils, Monitor, Plus, Sparkles, TrendingUp, Trees, Smartphone, Beef } from "lucide-react";
import { predictDay } from "@/lib/api";

const iconMap = { transport: Car, electricity: Zap, food: Utensils, devices: Monitor };

const Predict = () => {
  const [activities, setActivities] = useState([
    { type: "transport", kg: 1.4 },
    { type: "electricity", kg: 0.6 },
  ]);
  const [budget, setBudget] = useState(6.5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const add = (type) => setActivities([...activities, { type, kg: 0.5 }]);
  const remove = (i) => setActivities(activities.filter((_, idx) => idx !== i));
  const updateKg = (i, kg) => setActivities(activities.map((a, idx) => idx === i ? { ...a, kg } : a));

  const run = async () => {
    setLoading(true);
    try {
      const r = await predictDay({ morning_activities: activities, daily_budget_kg: budget });
      setResult(r);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6" data-testid="predict-root">
      <div className="glass p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Novel Feature 01</div>
            <h2 className="font-display text-3xl mt-1">Predictive Carbon Budget Alert</h2>
            <p className="text-sm text-[#9EABBC] mt-2 max-w-2xl">
              Log your first two hours. Our AI extrapolates your full-day CO₂ using the CarbonTracker
              first-epoch prediction technique — alerting you <em>before</em> you exceed budget.
            </p>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[#00FFB2]/10 text-[#00FFB2] border border-[#00FFB2]/25">
            Extends CarbonTracker [2]
          </span>
        </div>

        {/* Morning activities editor */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#9EABBC]">Morning activities (first 2 hrs)</div>
            {activities.map((a, i) => {
              const Icon = iconMap[a.type] || Car;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#00FFB2]/10 border border-[#00FFB2]/20 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[#00FFB2]" />
                  </div>
                  <select
                    value={a.type}
                    onChange={(e) => setActivities(activities.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}
                    className="input-glass !py-2 !px-3 text-sm w-40"
                    data-testid={`activity-type-${i}`}
                  >
                    <option value="transport">Transport</option>
                    <option value="electricity">Electricity</option>
                    <option value="food">Food</option>
                    <option value="devices">Devices</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    value={a.kg}
                    onChange={(e) => updateKg(i, parseFloat(e.target.value) || 0)}
                    className="input-glass !py-2 !px-3 text-sm flex-1"
                    placeholder="kg CO₂"
                    data-testid={`activity-kg-${i}`}
                  />
                  <button onClick={() => remove(i)} className="text-xs text-[#5C6B7A] hover:text-[#FF4D4D] px-2" data-testid={`activity-remove-${i}`}>×</button>
                </motion.div>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              {["transport", "electricity", "food", "devices"].map(t => (
                <button
                  key={t}
                  onClick={() => add(t)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[#9EABBC] hover:text-white hover:border-[#00FFB2]/30 transition"
                  data-testid={`add-${t}`}
                >
                  <Plus className="h-3 w-3 inline-block mr-1" /> {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#9EABBC]">Daily budget (kg CO₂)</div>
              <input
                type="range" min="3" max="12" step="0.5" value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value))}
                className="w-full mt-2 accent-[#00FFB2]"
                data-testid="budget-slider"
              />
              <div className="font-mono-data text-2xl neon-text-green mt-1">{budget} kg</div>
            </div>
            <button
              onClick={run}
              disabled={loading}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
              data-testid="predict-btn"
            >
              {loading ? "Predicting..." : (<>Predict full day <Sparkles className="h-4 w-4" /></>)}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
          data-testid="predict-result"
        >
          {/* Alert banner */}
          <div className={`glass p-6 glass-hover relative overflow-hidden glow-ring ${result.exceeds ? "" : ""}`}>
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${result.exceeds ? "bg-[#FFD166]/10 border border-[#FFD166]/30" : "bg-[#00FFB2]/10 border border-[#00FFB2]/30"}`}>
                {result.exceeds ? <AlertTriangle className="h-6 w-6 text-[#FFD166]" /> : <TrendingUp className="h-6 w-6 text-[#00FFB2]" />}
              </div>
              <div className="flex-1">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// AI Prediction</div>
                <div className="font-display text-2xl mt-1">{result.ai_headline}</div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div>
                    <div className="font-mono-data text-[10px] text-[#9EABBC]">Predicted</div>
                    <div className="font-mono-data text-2xl neon-text-green">{result.predicted_full_day_kg} kg</div>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <div className="font-mono-data text-[10px] text-[#9EABBC]">Budget</div>
                    <div className="font-mono-data text-2xl text-white">{result.budget_kg} kg</div>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <div className="font-mono-data text-[10px] text-[#9EABBC]">Delta</div>
                    <div className={`font-mono-data text-2xl ${result.exceeds ? "text-[#FFD166]" : "text-[#00FFB2]"}`}>
                      {result.over_pct > 0 ? "+" : ""}{result.over_pct}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Equivalents */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Equiv icon={<TreePine className="h-5 w-5" />} value={result.equivalents.trees_to_offset} label="trees to offset" />
            <Equiv icon={<Car className="h-5 w-5" />} value={result.equivalents.km_by_car} label="km by car" suffix=" km" />
            <Equiv icon={<Smartphone className="h-5 w-5" />} value={result.equivalents.smartphone_charges.toLocaleString()} label="phone charges" />
            <Equiv icon={<Beef className="h-5 w-5" />} value={result.equivalents.beef_burgers} label="beef burger equiv" />
          </div>

          {/* Hourly curve */}
          <div className="glass p-6 glass-hover">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// 24-hour projection</div>
            <div className="font-display text-xl mt-1">Predicted emission curve</div>
            <div className="h-[240px] mt-3">
              <ResponsiveContainer>
                <AreaChart data={result.hourly_curve} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FFB2" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#00D9FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="#5C6B7A" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
                  <ReferenceLine y={result.budget_kg} stroke="#FFD166" strokeDasharray="4 4" label={{ value: "Budget", fill: "#FFD166", fontSize: 10, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="kg" stroke="#00FFB2" strokeWidth={2.5} fill="url(#predGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const Equiv = ({ icon, value, label, suffix = "" }) => (
  <div className="glass p-5 glass-hover">
    <div className="h-9 w-9 rounded-lg bg-[#00FFB2]/10 border border-[#00FFB2]/20 flex items-center justify-center text-[#00FFB2] mb-3">
      {icon}
    </div>
    <div className="font-mono-data text-2xl">{value}{suffix}</div>
    <div className="text-xs text-[#9EABBC] mt-1">{label}</div>
  </div>
);

export default Predict;
