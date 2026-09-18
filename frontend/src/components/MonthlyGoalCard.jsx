import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Target } from "lucide-react";
import { getMonthlyGoal, saveMonthlyGoal } from "@/lib/api";
import { useUser } from "@/lib/UserContext";

export default function MonthlyGoalCard() {
  const { user } = useUser();
  const [goal, setGoal] = useState(null);
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!user?.id) return;
    try {
      const data = await getMonthlyGoal(user.id);
      setGoal(data);
      setTarget(data.goal_set ? String(data.monthly_target_kg) : "");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Monthly goal is unavailable right now.");
    }
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const save = async (event) => {
    event.preventDefault();
    const value = Number(target);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a monthly target greater than 0 kg CO2e.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveMonthlyGoal({ user_id: user.id, monthly_target_kg: value });
      await refresh();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Could not save the monthly goal.");
    } finally {
      setSaving(false);
    }
  };

  if (!goal) return null;
  const progress = goal.goal_set ? Math.min(100, (goal.current_month_kg / goal.monthly_target_kg) * 100) : 0;
  const statusLabel = goal.status === "on_track" ? "On track" : goal.status === "over_target" ? "Target exceeded" : "Projected over target";
  const statusColor = goal.status === "on_track" ? "text-green" : "text-[#FFD166]";

  return (
    <section className="glass p-4 sm:p-6 glass-hover min-w-0" data-testid="monthly-goal-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Monthly goal</div>
          <h2 className="mt-1 font-display text-xl text-main">Stay within your target</h2>
          <p className="mt-1 text-xs leading-relaxed text-secondary">Calculated only from saved activity records using a calendar-day run rate. This is not a model prediction.</p>
        </div>
        {goal.goal_set && <span className={`font-mono-data text-xs ${statusColor}`}>{statusLabel}</span>}
      </div>

      <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Monthly target (kg CO2e)</span>
          <input className="input-glass mt-1 font-mono-data" type="number" min="1" step="0.1" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="e.g. 150" />
        </label>
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2 text-sm disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          {saving ? "Saving..." : goal.goal_set ? "Update target" : "Set target"}
        </button>
      </form>
      {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">{error}</p>}

      {goal.goal_set && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Recorded this month" value={`${goal.current_month_kg} kg`} />
          <Metric label="Projected month end" value={`${goal.projected_month_end_kg} kg`} />
          <Metric label="Remaining daily allowance" value={`${goal.daily_allowance_kg} kg`} />
          <div className="sm:col-span-3">
            <div className="flex justify-between text-xs text-secondary"><span>Target progress</span><span>{goal.current_month_kg} / {goal.monthly_target_kg} kg</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-widget"><div className="h-full rounded-full bg-green" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-secondary"><CheckCircle2 className="h-3.5 w-3.5 text-green" />{goal.days_remaining} calendar days remaining this month</div>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg border border-glass-border bg-widget p-3"><div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">{label}</div><div className="mt-1 font-mono-data text-lg text-main">{value}</div></div>;
}
