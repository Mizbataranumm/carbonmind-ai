import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Car, Leaf, RotateCcw, Sparkles, Target, Trees } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { simulateFuture } from "@/lib/api";

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

const defaultForm = { transport: "mixed", diet: "mixed", current_annual_co2: "", annual_reduction_percent: 5, horizon_years: 10 };

const presets = [
  { id: "balanced", label: "Balanced routine", values: defaultForm },
  { id: "lower-impact", label: "Lower-impact shift", values: { ...defaultForm, transport: "public", diet: "vegetarian", annual_reduction_percent: 8 } },
  { id: "car", label: "Car-heavy routine", values: { ...defaultForm, transport: "car", diet: "mixed", annual_reduction_percent: 3 } },
];

export default function Future() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentPreset = useMemo(
    () => presets.find((preset) => JSON.stringify(preset.values) === JSON.stringify(form))?.id,
    [form],
  );

  const signals = [
    { icon: Leaf, label: "Starting footprint", value: form.current_annual_co2 ? `${form.current_annual_co2} t CO2e / year` : "Enter your baseline" },
    { icon: Target, label: "Annual target", value: `${form.annual_reduction_percent}% reduction` },
    { icon: Car, label: "Mobility context", value: transportOptions.find((option) => option.id === form.transport)?.label },
  ];

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(null);
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (!(Number(form.current_annual_co2) > 0)) {
      toast.error("Enter your current annual footprint to calculate a scenario");
      return;
    }
    setLoading(true);
    try {
      setResult(await simulateFuture(form));
    } catch {
      toast.error("Could not calculate this scenario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="future-root">
      <section className="glass overflow-hidden p-5 sm:p-7">
        <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Assumption studio</div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl">Future scenarios</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">Enter your own annual footprint and reduction target to explore a transparent planning path. Transport and diet guide recommendations only; they are not converted through hidden emission factors.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-glass-border bg-widget px-4 py-3">
            <div className="font-mono-data text-2xl text-green">{form.horizon_years}</div>
            <div className="text-xs text-secondary">year<br />horizon</div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {signals.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 border-t border-glass-border pt-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green/10 text-green"><Icon className="h-4 w-4" /></div>
              <div><div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">{label}</div><div className="mt-0.5 text-sm font-semibold text-main">{value}</div></div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="glass space-y-6 p-5 sm:p-6 lg:col-span-2" data-testid="future-form">
          <div className="flex items-start justify-between gap-3">
            <div><div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Build scenario</div><h3 className="mt-1 font-display text-xl">Choose assumptions</h3></div>
            <button type="button" onClick={() => { setForm(defaultForm); setResult(null); }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-glass-border bg-widget text-secondary transition hover:text-main" title="Reset scenario" aria-label="Reset scenario"><RotateCcw className="h-4 w-4" /></button>
          </div>

          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Starting point</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {presets.map((preset) => (
                <button key={preset.id} type="button" onClick={() => { setForm(preset.values); setResult(null); }} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${currentPreset === preset.id ? "border-green/50 bg-green/10 text-green" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}>{preset.label}</button>
              ))}
            </div>
          </div>

          <ChoiceGroup label="Transport pattern" options={transportOptions} value={form.transport} onChange={(value) => update("transport", value)} testid="select-transport" />
          <ChoiceGroup label="Diet" options={dietOptions} value={form.diet} onChange={(value) => update("diet", value)} testid="select-diet" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="future-baseline" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Current annual footprint</label>
              <input id="future-baseline" data-testid="input-baseline" type="number" min="0.01" step="0.01" required value={form.current_annual_co2} onChange={(event) => update("current_annual_co2", event.target.value)} className="input-glass mt-2" />
              <p className="mt-1 text-xs text-secondary">tonnes CO2e / year</p>
            </div>
            <div>
              <label htmlFor="future-reduction" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Annual reduction target</label>
              <input id="future-reduction" data-testid="input-reduction" type="number" min="0" max="100" step="0.5" value={form.annual_reduction_percent} onChange={(event) => update("annual_reduction_percent", Number(event.target.value) || 0)} className="input-glass mt-2" />
              <p className="mt-1 text-xs text-secondary">percent each year</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3"><label htmlFor="future-horizon" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Horizon</label><span className="font-mono-data text-sm text-green">{form.horizon_years} years</span></div>
            <input id="future-horizon" data-testid="input-horizon" type="range" min="3" max="25" value={form.horizon_years} onChange={(event) => update("horizon_years", Number(event.target.value))} className="mt-3 w-full accent-[#00FFB2]" />
          </div>

          <button data-testid="simulate-btn" type="submit" disabled={loading} className="btn-primary inline-flex w-full items-center justify-center gap-2 !py-3.5">{loading ? "Calculating..." : <>Calculate scenario <Sparkles className="h-4 w-4" /></>}</button>
        </form>

        <section className="lg:col-span-3">
          {!result ? (
            <div className="glass flex min-h-[490px] flex-col justify-between p-5 sm:p-7" data-testid="future-empty">
              <div>
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Ready to calculate</div>
                <h3 className="mt-1 font-display text-2xl">Your scenario inputs</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">The result will show the calculator&apos;s starting annual scenario, its selected-habit reduction path, and the assumptions behind it. Nothing here updates your real activity record.</p>
              </div>
              <div className="my-8 grid gap-3 sm:grid-cols-2">
                <InputSummary label="Transport" value={transportOptions.find((option) => option.id === form.transport)?.label} />
                <InputSummary label="Diet" value={dietOptions.find((option) => option.id === form.diet)?.label} />
                <InputSummary label="Starting footprint" value={form.current_annual_co2 ? `${form.current_annual_co2} t CO2e/year` : "Required"} />
                <InputSummary label="Reduction target" value={`${form.annual_reduction_percent}% / year`} />
              </div>
              <div className="border-t border-glass-border pt-5 text-sm leading-relaxed text-secondary">Select assumptions on the left, then calculate. Results are clearly marked as a transparent scenario, not a trained time-series forecast.</div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="future-result">
              <div className="glass p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Calculated scenario</div><h3 className="mt-1 font-display text-2xl">Year {new Date().getFullYear() + form.horizon_years}</h3><p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">{result.future_summary}</p></div>
                  <div className="rounded-xl border border-green/30 bg-green/10 p-3 text-right"><div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">Method</div><div className="mt-1 text-sm font-semibold text-green">Scenario calculator</div></div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Metric label="Starting annual scenario" value={`${result.current_annual_co2} t CO2e`} icon={Leaf} />
                  <Metric label={`Scenario at year ${form.horizon_years}`} value={`${result.projected_co2} t CO2e`} icon={Trees} color="var(--neon-green)" />
                </div>
              </div>

              <div className="glass min-w-0 p-5 sm:p-6">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Annual scenario path</div>
                <div className="mt-1 font-display text-xl">Assumption-driven trajectory</div>
                <div className="mt-4 h-[230px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={result.yearly_breakdown} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" /><XAxis dataKey="year" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, color: "var(--text-primary)" }} /><Line type="monotone" dataKey="co2" stroke="var(--neon-green)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--neon-green)" }} /></LineChart></ResponsiveContainer></div>
              </div>

              <div className="glass p-5 sm:p-6"><div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Largest assumed levers</div><div className="mt-1 font-display text-xl">Possible next choices</div><div className="mt-4 space-y-2">{result.recommendations.map((recommendation, index) => <div key={recommendation} className="flex items-center gap-3 rounded-xl border border-glass-border bg-widget p-3 text-sm"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-green/10 font-mono-data text-xs text-green">{index + 1}</div><span className="flex-1">{recommendation}</span><ArrowRight className="h-4 w-4 text-secondary" /></div>)}</div></div>

              <div className="border-l-2 border-green/40 pl-3 text-xs leading-relaxed text-secondary">{result.assumptions?.join(" ")}</div>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChoiceGroup({ label, options, value, onChange, testid }) {
  return <div data-testid={testid}><div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">{label}</div><div className="mt-2 grid grid-cols-2 gap-2">{options.map((option) => <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`rounded-xl border px-3 py-2.5 text-sm transition ${value === option.id ? "border-green/50 bg-green/10 text-green" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}>{option.label}</button>)}</div></div>;
}

function InputSummary({ label, value }) {
  return <div className="rounded-xl border border-glass-border bg-widget p-4"><div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">{label}</div><div className="mt-1 text-sm font-semibold text-main">{value}</div></div>;
}

function Metric({ label, value, icon: Icon, color = "var(--text-primary)" }) {
  return <div className="rounded-xl border border-glass-border bg-widget p-4"><div className="flex items-center gap-2 font-mono-data text-[9px] uppercase tracking-widest text-secondary"><Icon className="h-3.5 w-3.5" />{label}</div><div className="mt-2 font-mono-data text-xl" style={{ color }}>{value}</div></div>;
}
