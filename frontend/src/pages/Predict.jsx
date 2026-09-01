import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { AlertTriangle, TreePine, Car, Zap, Utensils, Monitor, Sparkles, TrendingUp, Smartphone, Beef, Coffee, Home, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { predictDay } from "@/lib/api";

const iconMap = { transport: Car, electricity: Zap, food: Utensils, devices: Monitor };
const typeColors = { transport: "var(--neon-green)", electricity: "var(--neon-cyan)", food: "#FFD166", devices: "#FF66E1" };

/* ── Sub-options per category ─────────────────────────────────── */
const CATEGORY_OPTIONS = {
  transport: [
    { label: "🚗 Car",         value: "car",      co2: 2.1 },
    { label: "🚌 Bus",         value: "bus",      co2: 0.8 },
    { label: "🚲 Bike / Cycle",value: "cycling",  co2: 0.0 },
    { label: "🚆 Train",       value: "train",    co2: 0.5 },
    { label: "🏍 Motorcycle",  value: "moto",     co2: 1.2 },
    { label: "🚶 Walk",        value: "walking",  co2: 0.0 },
  ],
  electricity: [
    { label: "💡 0.1 kWh – phone charge",    value: "0.1kWh", co2: 0.1 },
    { label: "🌀 0.5 kWh – fan 5 hrs",       value: "0.5kWh", co2: 0.2 },
    { label: "❄️ 1.0 kWh – AC 1 hr",         value: "1.0kWh", co2: 0.4 },
    { label: "🏠 2.0 kWh – full appliances", value: "2.0kWh", co2: 0.8 },
  ],
  food: [
    { label: "🍚 Rice meal",     value: "rice",    co2: 0.8 },
    { label: "🍗 Chicken meal",  value: "chicken", co2: 1.9 },
    { label: "🥗 Veg / Salad",  value: "salad",   co2: 0.3 },
    { label: "🥩 Beef meal",     value: "beef",    co2: 4.2 },
    { label: "🍞 Bread / Snack", value: "bread",   co2: 0.5 },
    { label: "🥛 Milk / Dairy",  value: "dairy",   co2: 0.6 },
    { label: "🍎 Fruit",         value: "fruit",   co2: 0.2 },
  ],
  devices: [
    { label: "📱 Phone (1 hr)",   value: "phone",  co2: 0.05 },
    { label: "💻 Laptop (4 hrs)", value: "laptop", co2: 0.2  },
    { label: "📺 TV (2 hrs)",     value: "tv",     co2: 0.15 },
    { label: "❄️ AC (1 hr)",      value: "ac",     co2: 0.5  },
  ],
};

const defaultSubItem = (type) => {
  const opts = CATEGORY_OPTIONS[type];
  return opts ? opts[0] : { label: "Other", value: "other", co2: 0.5 };
};

/* ── Presets ──────────────────────────────────────────────────── */
const presets = [
  { id: "commute", label: "Typical commute", icon: Coffee, items: [
    { type: "transport",   sub: "car",     kg: 2.1 },
    { type: "electricity", sub: "0.5kWh",  kg: 0.2 },
    { type: "food",        sub: "rice",    kg: 0.8 },
  ]},
  { id: "wfh", label: "Work from home", icon: Home, items: [
    { type: "electricity", sub: "1.0kWh",  kg: 0.4 },
    { type: "devices",     sub: "laptop",  kg: 0.2 },
    { type: "food",        sub: "salad",   kg: 0.3 },
  ]},
  { id: "errands", label: "Weekend errands", icon: ShoppingCart, items: [
    { type: "transport",   sub: "car",     kg: 2.1 },
    { type: "food",        sub: "chicken", kg: 1.9 },
  ]},
];

/* ── Dark-theme-safe select style ─────────────────────────────── */
const selectStyle = {
  color: "var(--text-primary)",
  background: "var(--bg-secondary)",
};

const Predict = () => {
  const [activities, setActivities] = useState(presets[0].items);
  const [budget, setBudget] = useState(6.5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const morningTotal = useMemo(() => activities.reduce((s, a) => s + (parseFloat(a.kg) || 0), 0), [activities]);

  /* ── Auto-log from Food Scanner via localStorage ─────────────── */
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key !== "cm_scan_result") return;
      try {
        const data = JSON.parse(e.newValue || "{}");
        if (!data || !data.co2) return;
        const newActivity = {
          type: "food",
          sub: data.value || "other",
          kg: parseFloat(data.co2) || 0.5,
        };
        setActivities((prev) => [...prev, newActivity]);
        toast.success(`🍽 "${data.label || "Scanned food"}" auto-logged from Scanner`);
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const applyPreset = (p) => { setActivities(p.items); setResult(null); };

  const add = (type) => {
    const first = defaultSubItem(type);
    setActivities([...activities, { type, sub: first.value, kg: first.co2 }]);
  };

  const remove = (i) => setActivities(activities.filter((_, idx) => idx !== i));

  const updateType = (i, type) => {
    const first = defaultSubItem(type);
    setActivities(activities.map((a, idx) =>
      idx === i ? { ...a, type, sub: first.value, kg: first.co2 } : a
    ));
  };

  const updateSub = (i, subValue) => {
    const opts = CATEGORY_OPTIONS[activities[i].type] || [];
    const opt = opts.find((o) => o.value === subValue);
    setActivities(activities.map((a, idx) =>
      idx === i ? { ...a, sub: subValue, kg: opt ? opt.co2 : a.kg } : a
    ));
  };

  const updateKg = (i, kg) =>
    setActivities(activities.map((a, idx) => idx === i ? { ...a, kg } : a));

  const run = async () => {
    if (activities.length === 0) { toast.error("Add at least one morning activity"); return; }
    setLoading(true);
    try {
      const r = await predictDay({ morning_activities: activities, daily_budget_kg: budget });
      setResult(r);
      setTimeout(() => document.getElementById("predict-result-anchor")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { toast.error("Prediction failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6" data-testid="predict-root">
      {/* Header */}
      <div className="glass p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Novel Feature 01</div>
            <h2 className="font-display text-3xl mt-1">Predictive Carbon Budget Alert</h2>
            <p className="text-sm text-secondary mt-2 max-w-2xl">
              Log your first two hours. Our AI extrapolates your full-day CO₂ using the CarbonTracker
              first-epoch prediction technique — alerting you <em>before</em> you exceed budget.
            </p>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-green/10 text-green border border-green/25">
            Extends CarbonTracker [2]
          </span>
        </div>

        {/* Quick presets */}
        <div className="mt-6">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary mb-2">Quick scenarios</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="p-3 rounded-xl bg-widget border border-glass-border hover:border-green/30 hover:bg-widget transition text-left group"
                data-testid={`preset-${p.id}`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center group-hover:bg-green/20 transition">
                    <p.icon className="h-4 w-4 text-green" />
                  </div>
                  <div className="font-medium text-sm">{p.label}</div>
                </div>
                <div className="font-mono-data text-[10px] text-secondary mt-1.5">
                  {p.items.reduce((s, i) => s + i.kg, 0).toFixed(1)} kg · {p.items.length} activities
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass p-6 glass-hover lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Morning activities (first 2 hrs)</div>
              <div className="font-display text-xl mt-1">Log what you did</div>
            </div>
            <div className="text-right">
              <div className="font-mono-data text-[10px] text-secondary uppercase tracking-widest">Morning so far</div>
              <div className="font-mono-data text-2xl neon-text-green">{morningTotal.toFixed(2)} <span className="text-sm text-secondary">kg</span></div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {activities.length === 0 && (
              <div className="text-sm text-secondary p-6 text-center border border-dashed border-glass-border rounded-xl">
                No activities yet. Pick a preset or add one below.
              </div>
            )}
            {activities.map((a, i) => {
              const Icon = iconMap[a.type] || Car;
              const color = typeColors[a.type];
              const subOpts = CATEGORY_OPTIONS[a.type] || [];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-xl bg-widget border border-glass-border transition"
                  data-testid={`activity-row-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg border flex items-center justify-center flex-shrink-0"
                         style={{ background: `${color}15`, borderColor: `${color}40` }}>
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>

                    <div className="flex-1 grid grid-cols-3 gap-2">
                      {/* Category */}
                      <div>
                        <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary mb-1">Category</div>
                        <select
                          value={a.type}
                          onChange={(e) => updateType(i, e.target.value)}
                          className="input-glass !py-2 !px-3 text-sm w-full cursor-pointer"
                          style={selectStyle}
                          data-testid={`activity-type-${i}`}
                        >
                          <option value="transport" style={selectStyle}>🚗 Transport</option>
                          <option value="electricity" style={selectStyle}>⚡ Electricity</option>
                          <option value="food" style={selectStyle}>🍽 Food</option>
                          <option value="devices" style={selectStyle}>💻 Devices</option>
                        </select>
                      </div>

                      {/* Sub-item */}
                      <div>
                        <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary mb-1">
                          {a.type === "transport" ? "Vehicle" :
                           a.type === "electricity" ? "Usage" :
                           a.type === "food" ? "Food item" : "Device"}
                        </div>
                        <select
                          value={a.sub || subOpts[0]?.value || ""}
                          onChange={(e) => updateSub(i, e.target.value)}
                          className="input-glass !py-2 !px-3 text-sm w-full cursor-pointer"
                          style={selectStyle}
                          data-testid={`activity-sub-${i}`}
                        >
                          {subOpts.map((opt) => (
                            <option key={opt.value} value={opt.value} style={selectStyle}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* CO₂ (auto-filled, editable) */}
                      <div>
                        <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary mb-1">CO₂ (kg)</div>
                        <input
                          type="number" step="0.01" min="0"
                          value={a.kg}
                          onChange={(e) => updateKg(i, parseFloat(e.target.value) || 0)}
                          className="input-glass !py-2 !px-3 text-sm w-full font-mono-data"
                          data-testid={`activity-kg-${i}`}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => remove(i)}
                      className="h-9 w-9 rounded-lg bg-widget border border-glass-border hover:bg-[#FF4D4D]/10 hover:border-[#FF4D4D]/30 hover:text-[#FF4D4D] text-secondary transition flex items-center justify-center"
                      data-testid={`activity-remove-${i}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-glass-border">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary w-full mb-1">Add activity</div>
            {["transport", "electricity", "food", "devices"].map(t => {
              const Icon = iconMap[t];
              return (
                <button
                  key={t}
                  onClick={() => add(t)}
                  className="text-xs px-3 py-2 rounded-full bg-widget border border-white/[0.08] text-secondary hover:text-main hover:border-green/30 hover:bg-widget-hover transition inline-flex items-center gap-1.5"
                  data-testid={`add-${t}`}
                >
                  <Icon className="h-3 w-3" /> <span className="capitalize">{t}</span>
                </button>
              );
            })}
            <div className="font-mono-data text-[9px] text-secondary w-full mt-1 opacity-60">
              💡 Scan a meal on the Food Scanner page — it auto-logs here!
            </div>
          </div>
        </div>

        {/* Budget + Run */}
        <div className="glass p-6 glass-hover space-y-5">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Daily budget</div>
            <div className="font-display text-xl mt-1">Set your target</div>
            <input
              type="range" min="3" max="12" step="0.5" value={budget}
              onChange={(e) => setBudget(parseFloat(e.target.value))}
              className="w-full mt-4 accent-[#00FFB2]"
              data-testid="budget-slider"
            />
            <div className="flex items-baseline justify-between mt-2">
              <div className="font-mono-data text-[10px] text-[#5C6B7A]">3 kg</div>
              <div className="font-mono-data text-3xl neon-text-green">{budget}<span className="text-sm text-secondary ml-1">kg</span></div>
              <div className="font-mono-data text-[10px] text-[#5C6B7A]">12 kg</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-widget border border-glass-border">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Live extrapolation</div>
            <div className="font-mono-data text-lg mt-1 text-main">
              ≈ {(morningTotal / 0.18).toFixed(2)} <span className="text-xs text-secondary">kg by end of day</span>
            </div>
            <div className="text-[11px] text-[#5C6B7A] mt-1">Based on 2hr → 100% morning ratio (18%)</div>
          </div>

          <button
            onClick={run}
            disabled={loading}
            className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-3.5"
            data-testid="predict-btn"
          >
            {loading ? "Analyzing..." : (<>Predict full day <Sparkles className="h-4 w-4" /></>)}
          </button>
        </div>
      </div>

      <div id="predict-result-anchor" />

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
          data-testid="predict-result"
        >
          <div className="glass p-6 glass-hover relative overflow-hidden glow-ring">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${result.exceeds ? "bg-[#FFD166]/10 border border-[#FFD166]/30" : "bg-green/10 border border-green/30"}`}>
                {result.exceeds ? <AlertTriangle className="h-6 w-6 text-[#FFD166]" /> : <TrendingUp className="h-6 w-6 text-green" />}
              </div>
              <div className="flex-1">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// AI Prediction</div>
                <div className="font-display text-xl sm:text-2xl mt-1 leading-tight">{result.ai_headline}</div>
                <div className="mt-4 grid grid-cols-3 gap-4 max-w-xl">
                  <MetricBlock label="Predicted" value={`${result.predicted_full_day_kg} kg`} color="var(--neon-green)" />
                  <MetricBlock label="Budget" value={`${result.budget_kg} kg`} color="#FFFFFF" />
                  <MetricBlock label="Delta" value={`${result.over_pct > 0 ? "+" : ""}${result.over_pct}%`} color={result.exceeds ? "#FFD166" : "var(--neon-green)"} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary mb-3">// Real-world equivalents</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Equiv icon={<TreePine className="h-5 w-5" />} value={result.equivalents.trees_to_offset} label="trees to offset" />
              <Equiv icon={<Car className="h-5 w-5" />} value={result.equivalents.km_by_car} label="km by car" />
              <Equiv icon={<Smartphone className="h-5 w-5" />} value={result.equivalents.smartphone_charges.toLocaleString()} label="phone charges" />
              <Equiv icon={<Beef className="h-5 w-5" />} value={result.equivalents.beef_burgers} label="beef burger equiv" />
            </div>
          </div>

          <div className="glass p-6 glass-hover">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// 24-hour projection</div>
            <div className="font-display text-xl mt-1">Predicted emission curve</div>
            <div className="h-[240px] mt-3">
              <ResponsiveContainer>
                <AreaChart data={result.hourly_curve} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--neon-green)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="#5C6B7A" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
                  <ReferenceLine y={result.budget_kg} stroke="#FFD166" strokeDasharray="4 4" label={{ value: "Budget", fill: "#FFD166", fontSize: 10, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="kg" stroke="var(--neon-green)" strokeWidth={2.5} fill="url(#predGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const MetricBlock = ({ label, value, color }) => (
  <div className="bg-widget border border-glass-border rounded-xl p-3">
    <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">{label}</div>
    <div className="font-mono-data text-xl mt-1" style={{ color }}>{value}</div>
  </div>
);

const Equiv = ({ icon, value, label }) => (
  <div className="glass p-5 glass-hover">
    <div className="h-9 w-9 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green mb-3">
      {icon}
    </div>
    <div className="font-mono-data text-2xl">{value}</div>
    <div className="text-xs text-secondary mt-1">{label}</div>
  </div>
);

export default Predict;
