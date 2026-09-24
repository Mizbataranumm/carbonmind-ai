import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Car, Leaf, RotateCcw, Sparkles, Target, Trees, Info } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { simulateFuture } from "@/lib/api";

const transportOptions = [
  { id: "car", label: "🚗 Mostly car", co2Hint: "Higher emissions" },
  { id: "mixed", label: "🚌 Mix of car & transit", co2Hint: "Average emissions" },
  { id: "public", label: "🚇 Public transit", co2Hint: "Lower emissions" },
  { id: "bike", label: "🚲 Cycling / Walking", co2Hint: "Lowest emissions" },
];

const dietOptions = [
  { id: "meat", label: "🥩 Meat daily", co2Hint: "Higher food emissions" },
  { id: "mixed", label: "🍽️ Mixed diet", co2Hint: "Average food emissions" },
  { id: "vegetarian", label: "🥗 Vegetarian", co2Hint: "Lower food emissions" },
  { id: "vegan", label: "🌱 Vegan", co2Hint: "Lowest food emissions" },
];

// Auto-calculate a realistic annual footprint from transport + diet choices
function estimateAnnualFootprint(transport, diet) {
  // Transport contribution (tonnes CO2e/year, India-adjusted averages)
  const transportMap = { car: 2.8, mixed: 1.6, public: 0.8, bike: 0.3 };
  // Diet contribution (tonnes CO2e/year)
  const dietMap = { meat: 2.5, mixed: 1.8, vegetarian: 1.2, vegan: 0.7 };
  // Base (electricity, devices, other daily living)
  const baseLiving = 1.0;

  return +(baseLiving + (transportMap[transport] || 1.6) + (dietMap[diet] || 1.8)).toFixed(1);
}

const reductionOptions = [
  { id: 3, label: "Small (3%)", desc: "Minor habit tweaks" },
  { id: 5, label: "Moderate (5%)", desc: "Noticeable lifestyle changes" },
  { id: 8, label: "Ambitious (8%)", desc: "Major commitment" },
  { id: 12, label: "Aggressive (12%)", desc: "Complete lifestyle overhaul" },
];

export default function Future() {
  const [transport, setTransport] = useState("mixed");
  const [diet, setDiet] = useState("mixed");
  const [reductionPercent, setReductionPercent] = useState(5);
  const [horizonYears, setHorizonYears] = useState(10);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const estimatedFootprint = useMemo(
    () => estimateAnnualFootprint(transport, diet),
    [transport, diet],
  );

  const submit = async (event) => {
    event?.preventDefault();
    setLoading(true);
    try {
      setResult(
        await simulateFuture({
          transport,
          diet,
          current_annual_co2: estimatedFootprint,
          annual_reduction_percent: reductionPercent,
          horizon_years: horizonYears,
        }),
      );
    } catch {
      toast.error("Could not calculate this scenario");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTransport("mixed");
    setDiet("mixed");
    setReductionPercent(5);
    setHorizonYears(10);
    setResult(null);
  };

  return (
    <div className="space-y-6" data-testid="future-root">
      {/* Header */}
      <section className="glass overflow-hidden p-5 sm:p-7">
        <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// What-if scenario</div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl">Future Forecast</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
              Select your current travel and food habits below. We'll estimate your annual carbon footprint and show how it could change if you reduce a little each year.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-green/30 bg-green/10 px-4 py-3">
            <div className="font-mono-data text-2xl text-green">{estimatedFootprint}</div>
            <div className="text-xs text-secondary">
              tonnes<br />CO₂e / year
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* LEFT: Form */}
        <form onSubmit={submit} className="glass space-y-6 p-5 sm:p-6 lg:col-span-2" data-testid="future-form">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Your lifestyle</div>
              <h3 className="mt-1 font-display text-xl">Tell us about your habits</h3>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-glass-border bg-widget text-secondary transition hover:text-main"
              title="Reset"
              aria-label="Reset scenario"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Transport */}
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">How do you usually travel?</div>
            <div className="mt-2 grid gap-2">
              {transportOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setTransport(option.id); setResult(null); }}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${transport === option.id ? "border-green/50 bg-green/10 text-green" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[10px] opacity-70">{option.co2Hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Diet */}
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">What's your usual diet?</div>
            <div className="mt-2 grid gap-2">
              {dietOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setDiet(option.id); setResult(null); }}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${diet === option.id ? "border-green/50 bg-green/10 text-green" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[10px] opacity-70">{option.co2Hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Estimated footprint display */}
          <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-cyan" />
              <span className="font-mono-data text-[10px] uppercase tracking-widest text-cyan">Estimated annual footprint</span>
            </div>
            <div className="mt-2 font-mono-data text-3xl text-green">{estimatedFootprint} <span className="text-sm text-secondary">tonnes CO₂e / year</span></div>
            <p className="mt-1 text-[11px] text-secondary leading-relaxed">Auto-calculated from your transport and diet choices above. India avg: 2.2t, Urban avg: 4.0t, Global avg: 4.5t</p>
          </div>

          {/* Reduction target */}
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">How much do you want to reduce each year?</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {reductionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setReductionPercent(option.id); setResult(null); }}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${reductionPercent === option.id ? "border-green/50 bg-green/10 text-green" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Horizon slider */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="future-horizon" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">How far into the future?</label>
              <span className="font-mono-data text-sm text-green">{horizonYears} years</span>
            </div>
            <input
              id="future-horizon"
              data-testid="input-horizon"
              type="range"
              min="3"
              max="25"
              value={horizonYears}
              onChange={(event) => { setHorizonYears(Number(event.target.value)); setResult(null); }}
              className="mt-3 w-full accent-[#00FFB2]"
            />
          </div>

          <button
            data-testid="simulate-btn"
            type="submit"
            disabled={loading}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 !py-3.5"
          >
            {loading ? "Calculating..." : <><Sparkles className="h-4 w-4" /> See my future impact</>}
          </button>
        </form>

        {/* RIGHT: Results */}
        <section className="lg:col-span-3">
          {!result ? (
            <div className="glass flex min-h-[490px] flex-col justify-between p-5 sm:p-7" data-testid="future-empty">
              <div>
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Ready to calculate</div>
                <h3 className="mt-1 font-display text-2xl">Your scenario preview</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">
                  Pick your travel and diet habits on the left, choose a reduction goal, then hit calculate. We&apos;ll show you a realistic projection of your carbon footprint over time.
                </p>
              </div>
              <div className="my-8 grid gap-3 sm:grid-cols-2">
                <InputSummary label="Transport" value={transportOptions.find((o) => o.id === transport)?.label} />
                <InputSummary label="Diet" value={dietOptions.find((o) => o.id === diet)?.label} />
                <InputSummary label="Estimated footprint" value={`${estimatedFootprint} t CO₂e / year`} />
                <InputSummary label="Reduction target" value={`${reductionPercent}% / year`} />
              </div>
              <div className="border-t border-glass-border pt-5 text-sm leading-relaxed text-secondary">
                This is a transparent what-if scenario, not a prediction. It helps you visualize how small changes compound over time.
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="future-result">
              <div className="glass p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Your future scenario</div>
                    <h3 className="mt-1 font-display text-2xl">By {new Date().getFullYear() + horizonYears}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">{result.future_summary}</p>
                  </div>
                  <div className="rounded-xl border border-green/30 bg-green/10 p-3 text-right">
                    <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">Method</div>
                    <div className="mt-1 text-sm font-semibold text-green">Scenario calculator</div>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Metric label="Your current footprint" value={`${result.current_annual_co2} t CO₂e`} icon={Leaf} />
                  <Metric label={`After ${horizonYears} years`} value={`${result.projected_co2} t CO₂e`} icon={Trees} color="var(--neon-green)" />
                </div>
              </div>

              <div className="glass min-w-0 p-5 sm:p-6">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Year-by-year projection</div>
                <div className="mt-1 font-display text-xl">Your carbon reduction path</div>
                <div className="mt-4 h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.yearly_breakdown} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                      <XAxis dataKey="year" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, color: "var(--text-primary)" }} />
                      <Line type="monotone" dataKey="co2" stroke="var(--neon-green)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--neon-green)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass p-5 sm:p-6">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Suggested next steps</div>
                <div className="mt-1 font-display text-xl">What you can do</div>
                <div className="mt-4 space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={rec} className="flex items-center gap-3 rounded-xl border border-glass-border bg-widget p-3 text-sm">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-green/10 font-mono-data text-xs text-green">{i + 1}</div>
                      <span className="flex-1">{rec}</span>
                      <ArrowRight className="h-4 w-4 text-secondary" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-l-2 border-green/40 pl-3 text-xs leading-relaxed text-secondary">
                {result.assumptions?.join(" ")}
              </div>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}

function InputSummary({ label, value }) {
  return (
    <div className="rounded-xl border border-glass-border bg-widget p-4">
      <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">{label}</div>
      <div className="mt-1 text-sm font-semibold text-main">{value}</div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, color = "var(--text-primary)" }) {
  return (
    <div className="rounded-xl border border-glass-border bg-widget p-4">
      <div className="flex items-center gap-2 font-mono-data text-[9px] uppercase tracking-widest text-secondary"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-2 font-mono-data text-xl" style={{ color }}>{value}</div>
    </div>
  );
}
