import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, CheckCircle, Loader2, Monitor, Utensils, X, Zap } from "lucide-react";
import { saveDailyActivities } from "@/lib/api";
import { useUser } from "@/lib/UserContext";

const categories = [
  { id: "transport", label: "Transport", icon: Car },
  { id: "electricity", label: "Electricity", icon: Zap },
  { id: "food", label: "Food", icon: Utensils },
  { id: "devices", label: "Devices", icon: Monitor },
];

const freshForm = () => ({ type: "transport", label: "", kg: "" });

export default function LogActivityModal({ open, onClose, onSaved }) {
  const { user } = useUser();
  const [form, setForm] = useState(freshForm);
  const [status, setStatus] = useState("editing");
  const [error, setError] = useState("");

  const category = useMemo(
    () => categories.find((item) => item.id === form.type) || categories[0],
    [form.type],
  );

  useEffect(() => {
    if (!open) {
      setForm(freshForm());
      setStatus("editing");
      setError("");
    }
  }, [open]);

  const close = () => {
    if (status !== "saving") onClose();
  };

  const save = async (event) => {
    event.preventDefault();
    const kg = Number(form.kg);
    const label = form.label.trim();
    if (!label || !Number.isFinite(kg) || kg <= 0) {
      setError("Add a description and an impact greater than 0 kg CO2e.");
      return;
    }
    if (!user?.id) {
      setError("Please sign in again before saving an activity.");
      return;
    }

    setError("");
    setStatus("saving");
    try {
      await saveDailyActivities({
        user_id: user.id,
        append: true,
        activities: [{
          type: form.type,
          kg,
          label,
          source: "manual_entry",
          verification_status: "user_entered",
          event_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }],
      });
      setStatus("saved");
      onSaved?.();
      window.setTimeout(() => onClose(), 1200);
    } catch (requestError) {
      setStatus("editing");
      setError(requestError?.response?.data?.detail || "Could not save this activity. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-md rounded-2xl border border-glass-border bg-panel p-5 shadow-2xl sm:p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              disabled={status === "saving"}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-widget hover:text-main disabled:opacity-50"
              aria-label="Close activity form"
            >
              <X className="h-4 w-4" />
            </button>

            {status === "saved" ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <CheckCircle className="h-14 w-14 text-green" />
                <h2 className="mt-4 font-display text-2xl text-main">Activity saved</h2>
                <p className="mt-2 text-sm text-secondary">Your record and dashboard have been updated.</p>
              </div>
            ) : (
              <form onSubmit={save} className="space-y-5">
                <div className="pr-10">
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Completed activity</div>
                  <h2 className="mt-1 font-display text-2xl text-main">Add activity</h2>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    Save a real, completed activity to today&apos;s record. This form records your estimate; it does not guess an impact from a generic multiplier.
                  </p>
                </div>

                <fieldset>
                  <legend className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Category</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {categories.map((item) => {
                      const Icon = item.icon;
                      const active = form.type === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, type: item.id }))}
                          className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${active ? "border-green/50 bg-green/10 text-main" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}
                        >
                          <Icon className={`h-4 w-4 ${active ? "text-green" : ""}`} />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="activity-label" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">What happened</label>
                  <input
                    id="activity-label"
                    value={form.label}
                    onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                    placeholder={`e.g. ${category.label === "Transport" ? "Drove to campus" : category.label === "Food" ? "Lunch" : "Home electricity"}`}
                    maxLength={120}
                    className="input-glass mt-2"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="activity-kg" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Estimated impact (kg CO2e)</label>
                  <input
                    id="activity-kg"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    value={form.kg}
                    onChange={(event) => setForm((current) => ({ ...current, kg: event.target.value }))}
                    placeholder="e.g. 1.20"
                    className="input-glass mt-2 font-mono-data"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-secondary">Use Food Scanner for photo-verified meals, or Plan today to explore a projection without changing this record.</p>
                </div>

                {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}

                <button type="submit" disabled={status === "saving"} className="btn-primary flex w-full items-center justify-center gap-2 !py-3.5 disabled:opacity-60">
                  {status === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save activity"}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
