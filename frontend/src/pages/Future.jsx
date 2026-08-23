import React, { useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Sparkles, ArrowRight, Wind, Trees, ThermometerSun } from "lucide-react";
import { simulateFuture } from "@/lib/api";
import AnimatedEarth from "@/components/AnimatedEarth";
import ParticleField from "@/components/ParticleField";

const transportOptions = [
  { id: "car", label: "Car-heavy" },
  { id: "mixed", label: "Mixed" },
  { id: "public", label: "Public transit" },
  { id: "bike", label: "Cycling first" },
];
const dietOptions = [
  { id: "meat", label: "Meat daily" },
  { id: "mixed", label: "Mixed" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
];

const Future = () => {
  const [form, setForm] = useState({ transport: "mixed", diet: "mixed", electricity_kwh: 3200, flights_per_year: 2, horizon_years: 10 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await simulateFuture(form);
      setResult(r);
    } finally { setLoading(false); }
  };

  return (
    <div className="relative" data-testid="future-root">
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <form onSubmit={submit} className="glass p-7 glass-hover lg:col-span-2 space-y-5" data-testid="future-form">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// AI Future Simulator</div>
            <h2 className="font-display text-2xl mt-1">Meet your future self.</h2>
            <p className="text-sm text-secondary mt-2">Tell us how you live. We'll project your 10-year footprint and the Earth around you.</p>
          </div>

          <SelectGroup label="Transport pattern" options={transportOptions} value={form.transport} onChange={(v) => setForm({ ...form, transport: v })} testid="select-transport" />
          <SelectGroup label="Diet" options={dietOptions} value={form.diet} onChange={(v) => setForm({ ...form, diet: v })} testid="select-diet" />

          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Annual electricity (kWh)</label>
            <input
              data-testid="input-electricity"
              type="number"
              value={form.electricity_kwh}
              onChange={(e) => setForm({ ...form, electricity_kwh: parseFloat(e.target.value) || 0 })}
              className="input-glass mt-1"
            />
          </div>

          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Flights / year</label>
            <input
              data-testid="input-flights"
              type="number"
              value={form.flights_per_year}
              onChange={(e) => setForm({ ...form, flights_per_year: parseInt(e.target.value) || 0 })}
              className="input-glass mt-1"
            />
          </div>

          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Horizon: {form.horizon_years} years</label>
            <input
              data-testid="input-horizon"
              type="range" min="3" max="25" value={form.horizon_years}
              onChange={(e) => setForm({ ...form, horizon_years: parseInt(e.target.value) })}
              className="w-full mt-2 accent-[#00FFB2]"
            />
          </div>

          <button data-testid="simulate-btn" type="submit" disabled={loading} className="btn-primary w-full inline-flex items-center justify-center gap-2">
            {loading ? "Simulating..." : (<>Run simulation <Sparkles className="h-4 w-4" /></>)}
          </button>
        </form>

        {/* Result */}
        <div className="lg:col-span-3 relative">
          {!result && (
            <div className="glass p-10 glass-hover h-full flex flex-col items-center justify-center text-center min-h-[420px] relative overflow-hidden" data-testid="future-empty">
              <ParticleField count={24} color="mixed" />
              <AnimatedEarth size={280} health={75} />
              <div className="mt-4 font-mono-data text-[11px] uppercase tracking-widest text-green">// awaiting input</div>
              <p className="text-secondary max-w-md mt-3">
                Enter your lifestyle pattern. The simulator will reveal a cinematic projection
                of your carbon impact and Earth's response.
              </p>
            </div>
          )}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-5"
              data-testid="future-result"
            >
              <div className="glass p-7 glass-hover relative overflow-hidden glow-ring">
                <ParticleField count={14} color="mixed" />
                <div className="grid sm:grid-cols-2 gap-6 items-center relative">
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Future You · Year {new Date().getFullYear() + form.horizon_years}</div>
                    <h3 className="font-display text-3xl mt-2 leading-tight">{result.future_summary.split(".")[0]}.</h3>
                    <p className="text-sm text-secondary mt-3 leading-relaxed">{result.future_summary}</p>
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      <Stat label="Today" value={`${result.current_annual_co2}t`} icon={<Wind className="h-3.5 w-3.5" />} />
                      <Stat label="Future" value={`${result.projected_co2}t`} color="var(--neon-green)" icon={<Trees className="h-3.5 w-3.5" />} />
                      <Stat label="Δ Temp" value={`${result.future_temp_delta >= 0 ? "+" : ""}${result.future_temp_delta}°C`} color={result.future_temp_delta > 0 ? "#FFD166" : "var(--neon-green)"} icon={<ThermometerSun className="h-3.5 w-3.5" />} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <AnimatedEarth size={240} health={result.earth_health} />
                    <div className="mt-3 font-mono-data text-[11px] uppercase tracking-widest text-secondary">Earth Health</div>
                    <div className="font-mono-data text-2xl neon-text-green">{result.earth_health}<span className="text-sm text-secondary">/100</span></div>
                  </div>
                </div>
              </div>

              <div className="glass p-6 glass-hover">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// 10-year carbon trajectory</div>
                <div className="h-[220px] mt-3">
                  <ResponsiveContainer>
                    <LineChart data={result.yearly_breakdown} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                      <XAxis dataKey="year" stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
                      <Line type="monotone" dataKey="co2" stroke="var(--neon-green)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--neon-green)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass p-6 glass-hover">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// AI prescriptive actions</div>
                <div className="font-display text-xl mt-1">Your fastest wins</div>
                <div className="mt-3 space-y-2">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-widget border border-glass-border hover:border-green/20 transition" data-testid={`future-rec-${i}`}>
                      <div className="h-6 w-6 rounded-md bg-green/15 text-green flex items-center justify-center text-xs font-mono-data">{i + 1}</div>
                      <div className="text-sm flex-1">{r}</div>
                      <ArrowRight className="h-4 w-4 text-[#5C6B7A]" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

const SelectGroup = ({ label, options, value, onChange, testid }) => (
  <div data-testid={testid}>
    <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">{label}</label>
    <div className="grid grid-cols-2 gap-2 mt-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`text-xs px-3 py-2.5 rounded-xl border transition ${value === o.id ? "bg-green/10 border-green/40 text-green" : "bg-widget border-glass-border text-secondary hover:text-main hover:border-glass-border"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const Stat = ({ label, value, color = "#FFFFFF", icon }) => (
  <div className="bg-widget border border-glass-border rounded-xl p-3">
    <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary flex items-center gap-1">{icon}{label}</div>
    <div className="font-mono-data text-lg mt-1" style={{ color }}>{value}</div>
  </div>
);

export default Future;
