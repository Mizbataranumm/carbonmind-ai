import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, CheckCircle, Loader2, Monitor, Utensils, X, Zap } from "lucide-react";
import { estimateTransport, getTransportCatalog, saveDailyActivities } from "@/lib/api";
import { estimateFoodItemCo2 } from "@/lib/foodEstimator";
import { useUser } from "@/lib/UserContext";

const categories = [
  { id: "transport", label: "Transport", icon: Car },
  { id: "electricity", label: "Electricity", icon: Zap },
  { id: "food", label: "Food", icon: Utensils },
  { id: "devices", label: "Devices", icon: Monitor },
];

// ── Electricity: grid emission factor (India avg ~0.82 kg CO2/kWh)
const ELECTRICITY_FACTOR = 0.82; // kg CO2e per kWh

// ── Device wattage presets (watts)
const DEVICE_PRESETS = [
  { id: "laptop",       label: "Laptop",             watts: 45 },
  { id: "desktop",      label: "Desktop PC",          watts: 150 },
  { id: "smartphone",   label: "Smartphone charging", watts: 10 },
  { id: "tv",           label: "Television",          watts: 120 },
  { id: "ac",           label: "Air Conditioner",     watts: 1500 },
  { id: "fan",          label: "Ceiling Fan",         watts: 75 },
  { id: "fridge",       label: "Refrigerator",        watts: 150 },
  { id: "washing",      label: "Washing Machine",     watts: 500 },
  { id: "microwave",    label: "Microwave",           watts: 1000 },
  { id: "other",        label: "Other device",        watts: 100 },
];

// ── Food emission factors (kg CO2e per serving)
const FOOD_PRESETS = [
  { id: "beef",         label: "Beef / Mutton (1 serving ~150g)",  kg: 3.6 },
  { id: "chicken",      label: "Chicken (1 serving ~150g)",         kg: 0.9 },
  { id: "fish",         label: "Fish (1 serving ~150g)",            kg: 0.7 },
  { id: "eggs",         label: "Eggs (2 eggs)",                     kg: 0.4 },
  { id: "milk",         label: "Milk (1 glass ~250ml)",             kg: 0.3 },
  { id: "cheese",       label: "Cheese (50g)",                      kg: 0.6 },
  { id: "rice",         label: "Rice (1 cup cooked)",               kg: 0.16 },
  { id: "bread",        label: "Bread (2 slices)",                  kg: 0.08 },
  { id: "lentils",      label: "Lentils / Dal (1 bowl)",            kg: 0.1 },
  { id: "vegetables",   label: "Mixed vegetables (1 serving)",      kg: 0.05 },
  { id: "coffee",       label: "Coffee (1 cup)",                    kg: 0.28 },
  { id: "tea",          label: "Tea (1 cup)",                       kg: 0.03 },
  { id: "chocolate",    label: "Chocolate (50g)",                   kg: 0.9 },
  { id: "pizza",        label: "Pizza (1 slice)",                   kg: 0.5 },
  { id: "burger",       label: "Burger (1 serving)",                kg: 2.5 },
];

const freshForm = () => ({
  type: "transport",
  label: "",
  kg: "",
  // transport
  transportFactorId: "",
  distanceKm: "",
  passengers: "1",
  // electricity
  elecDevice: "laptop",
  elecHours: "",
  // food
  foodItem: "chicken",
  foodName: "Chicken",
  foodServings: "1",
  // devices
  devPreset: "laptop",
  devHours: "",
  devCustomWatts: "",
});

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">{label}</span>
      {children}
    </label>
  );
}

export default function LogActivityModal({ open, onClose, onSaved }) {
  const { user } = useUser();
  const [form, setForm] = useState(freshForm);
  const [status, setStatus] = useState("editing");
  const [error, setError] = useState("");
  const [transportFactors, setTransportFactors] = useState([]);
  const [transportEstimate, setTransportEstimate] = useState(null);

  const category = useMemo(
    () => categories.find((item) => item.id === form.type) || categories[0],
    [form.type],
  );

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm(freshForm());
      setStatus("editing");
      setError("");
      setTransportEstimate(null);
    }
  }, [open]);

  // Load transport factors
  useEffect(() => {
    if (!open) return;
    getTransportCatalog().then(({ factors }) => {
      setTransportFactors(factors);
      setForm((current) =>
        current.transportFactorId ? current : { ...current, transportFactorId: factors[0]?.factor_id || "" }
      );
    }).catch(() => setError("Transport factors could not be loaded."));
  }, [open]);

  // ── Transport: auto-calculate from distance
  useEffect(() => {
    if (form.type !== "transport" || !form.transportFactorId || !Number(form.distanceKm)) {
      if (form.type === "transport") setTransportEstimate(null);
      return;
    }
    let active = true;
    estimateTransport({
      factor_id: form.transportFactorId,
      distance_km: Number(form.distanceKm),
      passengers: Math.max(1, Number(form.passengers) || 1),
    })
      .then((result) => {
        if (!active) return;
        setTransportEstimate(result);
        setForm((current) => ({ ...current, kg: String(result.co2_kg) }));
      })
      .catch((err) => active && setError(err?.response?.data?.detail || "Could not calculate this trip."));
    return () => { active = false; };
  }, [form.type, form.transportFactorId, form.distanceKm, form.passengers]);

  // ── Electricity: calculate kWh → CO2e from device + hours
  useEffect(() => {
    if (form.type !== "electricity") return;
    const preset = DEVICE_PRESETS.find((d) => d.id === form.elecDevice);
    const hours = Number(form.elecHours);
    if (!preset || !hours || hours <= 0) { setForm((c) => ({ ...c, kg: "" })); return; }
    const kwh = (preset.watts * hours) / 1000;
    const co2 = +(kwh * ELECTRICITY_FACTOR).toFixed(3);
    setForm((c) => ({ ...c, kg: String(co2) }));
  }, [form.type, form.elecDevice, form.elecHours]);

  // ── Food: look up CO2e per serving
  useEffect(() => {
    if (form.type !== "food") return;
    const preset = FOOD_PRESETS.find((f) => f.id === form.foodItem || f.label.toLowerCase().includes((form.foodName || "").toLowerCase()));
    const servings = Number(form.foodServings) || 1;
    const co2PerServing = preset ? preset.kg : estimateFoodItemCo2(form.foodName, FOOD_PRESETS);
    const co2 = +(co2PerServing * servings).toFixed(3);
    setForm((c) => ({ ...c, kg: String(co2) }));
  }, [form.type, form.foodItem, form.foodName, form.foodServings]);

  // ── Devices: watts × hours → kWh → CO2e
  useEffect(() => {
    if (form.type !== "devices") return;
    const preset = DEVICE_PRESETS.find((d) => d.id === form.devPreset);
    const watts = form.devPreset === "other" ? Number(form.devCustomWatts) : preset?.watts || 0;
    const hours = Number(form.devHours);
    if (!watts || !hours || hours <= 0) { setForm((c) => ({ ...c, kg: "" })); return; }
    const kwh = (watts * hours) / 1000;
    const co2 = +(kwh * ELECTRICITY_FACTOR).toFixed(3);
    setForm((c) => ({ ...c, kg: String(co2) }));
  }, [form.type, form.devPreset, form.devHours, form.devCustomWatts]);

  const close = () => { if (status !== "saving") onClose(); };

  const save = async (event) => {
    event.preventDefault();
    const kg = Number(form.kg);
    let label = form.label.trim();
    if (!label || !Number.isFinite(kg) || kg <= 0) {
      setError("Add a description and an impact greater than 0 kg CO2e.");
      return;
    }
    // Enrich label for transport
    if (form.type === "transport" && form.distanceKm) {
      const distance = Number(form.distanceKm);
      if (!Number.isFinite(distance) || distance <= 0) { setError("Distance must be greater than 0 km."); return; }
      const passengers = Math.max(1, Number(form.passengers) || 1);
      const factor = transportFactors.find((item) => item.factor_id === form.transportFactorId);
      if (!transportEstimate || !factor) { setError("Wait for the transport estimate before saving."); return; }
      label = `${label} · ${factor.display_name}, ${distance} km${passengers > 1 ? `, ${passengers} people` : ""}`;
    }
    if (!user?.id) { setError("Please sign in again before saving an activity."); return; }

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
    } catch (err) {
      setStatus("editing");
      setError(err?.response?.data?.detail || "Could not save this activity. Please try again.");
    }
  };

  // ── Helper label snippet for the CO2e field
  const co2HintText = {
    transport: transportEstimate
      ? `${transportEstimate.formula} = ${transportEstimate.co2_kg} kg CO2e. ${transportEstimate.factor.boundary}`
      : "Enter distance above to auto-calculate from the cited DESNZ 2026 factor.",
    electricity: form.elecHours
      ? `${DEVICE_PRESETS.find(d => d.id === form.elecDevice)?.watts}W × ${form.elecHours}h ÷ 1000 × 0.82 kg/kWh (India avg grid)`
      : "Select appliance and enter hours used to auto-calculate.",
    food: form.kg
      ? `Based on lifecycle emissions for this food item (per serving).`
      : "Select food item and servings to auto-calculate.",
    devices: form.devHours
      ? `${form.devPreset === "other" ? form.devCustomWatts || "?" : DEVICE_PRESETS.find(d => d.id === form.devPreset)?.watts}W × ${form.devHours}h ÷ 1000 × 0.82 kg/kWh (India avg grid)`
      : "Select device and enter hours used to auto-calculate.",
  }[form.type] || "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-glass-border bg-panel p-5 shadow-2xl overscroll-contain sm:p-6"
            onMouseDown={(e) => e.stopPropagation()}
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
                    Save a real, completed activity to today&apos;s record. Fill in the fields below — the CO2e is calculated for you.
                  </p>
                </div>

                {/* ── Category selector */}
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
                          onClick={() => setForm({
                            ...freshForm(),
                            type: item.id,
                            transportFactorId: transportFactors[0]?.factor_id || "",
                          })}
                          className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${active ? "border-green/50 bg-green/10 text-main" : "border-glass-border bg-widget text-secondary hover:border-green/30 hover:text-main"}`}
                        >
                          <Icon className={`h-4 w-4 ${active ? "text-green" : ""}`} />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* ── What happened (free text — persists across category switches) */}
                <div>
                  <label htmlFor="activity-label" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">
                    What happened
                  </label>
                  <input
                    id="activity-label"
                    value={form.label}
                    onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
                    placeholder={
                      form.type === "transport" ? "e.g. Drove to college" :
                      form.type === "electricity" ? "e.g. Used AC in the evening" :
                      form.type === "food" ? "e.g. Had chicken for lunch" :
                      "e.g. Used laptop for 3 hrs"
                    }
                    maxLength={120}
                    className="input-glass mt-2"
                    autoFocus
                  />
                </div>

                {/* ── Transport helper fields */}
                {form.type === "transport" && (
                  <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Travel mode">
                      <select
                        value={form.transportFactorId}
                        onChange={(e) => setForm((c) => ({ ...c, transportFactorId: e.target.value }))}
                        className="input-glass w-full"
                      >
                        {transportFactors.map((f) => <option key={f.factor_id} value={f.factor_id}>{f.display_name}</option>)}
                      </select>
                    </Field>
                    <Field label="Distance (km)">
                      <input
                        type="number" min="0.1" step="0.1" inputMode="decimal"
                        value={form.distanceKm}
                        onChange={(e) => setForm((c) => ({ ...c, distanceKm: e.target.value }))}
                        placeholder="e.g. 12"
                        className="input-glass w-full font-mono-data"
                      />
                    </Field>
                    <Field label="People sharing">
                      <input
                        type="number" min="1" step="1" inputMode="numeric"
                        value={form.passengers}
                        onChange={(e) => setForm((c) => ({ ...c, passengers: e.target.value }))}
                        className="input-glass w-full font-mono-data"
                      />
                    </Field>
                  </fieldset>
                )}

                {/* ── Electricity helper fields */}
                {form.type === "electricity" && (
                  <fieldset className="grid grid-cols-2 gap-3">
                    <Field label="Appliance">
                      <select
                        value={form.elecDevice}
                        onChange={(e) => setForm((c) => ({ ...c, elecDevice: e.target.value }))}
                        className="input-glass w-full"
                      >
                        {DEVICE_PRESETS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Hours used">
                      <input
                        type="number" min="0.1" step="0.1" inputMode="decimal"
                        value={form.elecHours}
                        onChange={(e) => setForm((c) => ({ ...c, elecHours: e.target.value }))}
                        placeholder="e.g. 2"
                        className="input-glass w-full font-mono-data"
                      />
                    </Field>
                  </fieldset>
                )}

                {/* ── Food helper fields */}
                {form.type === "food" && (
                  <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Food item (type or select)">
                      <input
                        type="text"
                        list="modal-food-presets"
                        value={form.foodName || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((c) => ({
                            ...c,
                            foodName: val,
                            label: c.label && c.label !== c.foodName ? c.label : val,
                          }));
                        }}
                        placeholder="e.g. Chicken, Biryani, Salad..."
                        className="input-glass w-full"
                      />
                      <datalist id="modal-food-presets">
                        {FOOD_PRESETS.map((f) => (
                          <option key={f.id} value={f.label.split(" (")[0]}>
                            {f.label}
                          </option>
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Servings">
                      <input
                        type="number" min="0.5" step="0.5" inputMode="decimal"
                        value={form.foodServings}
                        onChange={(e) => setForm((c) => ({ ...c, foodServings: e.target.value }))}
                        placeholder="1"
                        className="input-glass w-full font-mono-data"
                      />
                    </Field>
                  </fieldset>
                )}

                {/* ── Devices helper fields */}
                {form.type === "devices" && (
                  <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Device">
                      <select
                        value={form.devPreset}
                        onChange={(e) => setForm((c) => ({ ...c, devPreset: e.target.value }))}
                        className="input-glass w-full"
                      >
                        {DEVICE_PRESETS.map((d) => <option key={d.id} value={d.id}>{d.label} ({d.watts}W)</option>)}
                      </select>
                    </Field>
                    <Field label="Hours used">
                      <input
                        type="number" min="0.1" step="0.1" inputMode="decimal"
                        value={form.devHours}
                        onChange={(e) => setForm((c) => ({ ...c, devHours: e.target.value }))}
                        placeholder="e.g. 3"
                        className="input-glass w-full font-mono-data"
                      />
                    </Field>
                    {form.devPreset === "other" && (
                      <Field label="Custom wattage (W)">
                        <input
                          type="number" min="1" step="1" inputMode="numeric"
                          value={form.devCustomWatts}
                          onChange={(e) => setForm((c) => ({ ...c, devCustomWatts: e.target.value }))}
                          placeholder="e.g. 200"
                          className="input-glass w-full font-mono-data sm:col-span-2"
                        />
                      </Field>
                    )}
                  </fieldset>
                )}

                {/* ── CO2e result (read-only when auto-calculated, editable otherwise) */}
                <div>
                  <label htmlFor="activity-kg" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">
                    Estimated impact (kg CO2e)
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="activity-kg"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      inputMode="decimal"
                      value={form.kg}
                      onChange={(e) => setForm((c) => ({ ...c, kg: e.target.value }))}
                      placeholder="Auto-calculated above ↑"
                      className={`input-glass font-mono-data w-full ${form.kg ? "text-green font-bold" : ""}`}
                      readOnly={
                        (form.type === "transport" && Boolean(transportEstimate)) ||
                        (form.type === "electricity" && Boolean(form.elecHours)) ||
                        (form.type === "food") ||
                        (form.type === "devices" && Boolean(form.devHours))
                      }
                    />
                    {form.kg && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-data text-xs text-green">
                        kg CO2e
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-secondary">{co2HintText}</p>
                </div>

                {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}

                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="btn-primary flex w-full items-center justify-center gap-2 !py-3.5 disabled:opacity-60"
                >
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
