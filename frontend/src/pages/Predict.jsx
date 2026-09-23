import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { AlertTriangle, Car, Zap, Utensils, Monitor, Sparkles, TrendingUp, Coffee, Home, ShoppingCart, Trash2, CheckCircle, Navigation } from "lucide-react";
import { toast } from "sonner";
import { getFoodCatalog, predictDay, saveDailyActivities } from "@/lib/api";
import GpsCommuteModal from "@/components/GpsCommuteModal";
import { estimateFoodItemCo2 } from "@/lib/foodEstimator";
import { useUser } from "@/lib/UserContext";

const iconMap = { transport: Car, electricity: Zap, food: Utensils, devices: Monitor };
const typeColors = { transport: "var(--neon-green)", electricity: "var(--neon-cyan)", food: "#FFD166", devices: "#FF66E1" };

/* ── Standard Catalogs with Emission Factors ── */
export const TRANSPORT_CATALOG = [
  { value: "car_petrol", label: "Car (Petrol)", factor: 0.170, defaultAmount: 10, unit: "km" },
  { value: "car_diesel", label: "Car (Diesel)", factor: 0.173, defaultAmount: 10, unit: "km" },
  { value: "car_ev", label: "Electric Car (EV)", factor: 0.030, defaultAmount: 10, unit: "km" },
  { value: "bus", label: "Bus (Local / Public)", factor: 0.080, defaultAmount: 10, unit: "km" },
  { value: "moto", label: "Motorcycle / Scooter", factor: 0.105, defaultAmount: 10, unit: "km" },
  { value: "auto", label: "Auto Rickshaw", factor: 0.070, defaultAmount: 6, unit: "km" },
  { value: "train", label: "Train / Metro", factor: 0.035, defaultAmount: 15, unit: "km" },
  { value: "cycling", label: "Bicycle / Cycle", factor: 0.000, defaultAmount: 5, unit: "km" },
  { value: "walking", label: "Walking", factor: 0.000, defaultAmount: 2, unit: "km" },
  { value: "flight_domestic", label: "Flight (Domestic)", factor: 0.245, defaultAmount: 400, unit: "km" },
  { value: "flight_intl", label: "Flight (International)", factor: 0.190, defaultAmount: 1200, unit: "km" },
];

export const ELECTRICITY_CATALOG = [
  { value: "grid_kwh", label: "Electricity Usage (direct kWh)", factor: 0.82, defaultAmount: 2.5, unit: "kWh" },
  { value: "ac", label: "Air Conditioner (1.5 kW)", factor: 1.23, defaultAmount: 2, unit: "hrs" },
  { value: "fan", label: "Ceiling Fan (75W)", factor: 0.06, defaultAmount: 4, unit: "hrs" },
  { value: "geyser", label: "Water Heater / Geyser (2 kW)", factor: 1.64, defaultAmount: 0.5, unit: "hrs" },
  { value: "fridge", label: "Refrigerator", factor: 0.12, defaultAmount: 6, unit: "hrs" },
  { value: "washing", label: "Washing Machine", factor: 0.41, defaultAmount: 1, unit: "hrs" },
  { value: "lighting", label: "LED / Room Lights", factor: 0.03, defaultAmount: 4, unit: "hrs" },
  { value: "appliances", label: "Home Appliances", factor: 0.50, defaultAmount: 2, unit: "hrs" },
];

export const DEVICE_CATALOG = [
  { value: "laptop", label: "Laptop", factor: 0.04, defaultAmount: 3, unit: "hrs" },
  { value: "smartphone", label: "Smartphone Charging", factor: 0.01, defaultAmount: 2, unit: "hrs" },
  { value: "desktop", label: "Desktop PC", factor: 0.12, defaultAmount: 3, unit: "hrs" },
  { value: "tv", label: "Television (LED)", factor: 0.08, defaultAmount: 2, unit: "hrs" },
  { value: "monitor", label: "External Display / Monitor", factor: 0.03, defaultAmount: 4, unit: "hrs" },
];

/* ── Fallback Heuristics for Custom Free-Text ── */
function estimateCustomTransportFactor(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("walk") || t.includes("cycle") || t.includes("bike") || t.includes("foot")) return 0.0;
  if (t.includes("train") || t.includes("metro") || t.includes("subway") || t.includes("rail")) return 0.035;
  if (t.includes("ev") || t.includes("electric") || t.includes("tesla") || t.includes("nexon")) return 0.030;
  if (t.includes("auto") || t.includes("rickshaw") || t.includes("tuk")) return 0.070;
  if (t.includes("bus")) return 0.080;
  if (t.includes("moto") || t.includes("scooter") || t.includes("activa")) return 0.105;
  if (t.includes("diesel")) return 0.173;
  if (t.includes("flight") || t.includes("plane") || t.includes("air")) return 0.220;
  return 0.170; // standard car default
}

function estimateCustomElectricityFactor(text, unit) {
  const t = (text || "").toLowerCase();
  if (unit === "kWh" || t.includes("kwh") || t.includes("unit") || t.includes("meter")) return 0.82;
  if (t.includes("ac") || t.includes("air con") || t.includes("cooling")) return 1.23;
  if (t.includes("geyser") || t.includes("heater")) return 1.64;
  if (t.includes("fan")) return 0.06;
  if (t.includes("fridge") || t.includes("refrigerator")) return 0.12;
  if (t.includes("wash")) return 0.41;
  if (t.includes("light") || t.includes("led") || t.includes("bulb")) return 0.03;
  return 0.50;
}

function estimateCustomDeviceFactor(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("phone") || t.includes("mobile") || t.includes("tablet")) return 0.01;
  if (t.includes("laptop") || t.includes("macbook")) return 0.04;
  if (t.includes("desktop") || t.includes("pc") || t.includes("gaming")) return 0.12;
  if (t.includes("tv") || t.includes("television")) return 0.08;
  return 0.04;
}

/* ── Calculate CO2e from Activity Amount & Type ── */
function calculateActivityKg(activity, foodOptions) {
  const amount = Number(activity.amount) || 0;
  if (amount <= 0) return 0;

  if (activity.type === "transport") {
    const item = TRANSPORT_CATALOG.find(
      (o) => o.value === activity.sub || o.label.toLowerCase() === (activity.customText || "").toLowerCase()
    );
    const factor = item ? item.factor : estimateCustomTransportFactor(activity.customText || activity.sub);
    return +(amount * factor).toFixed(2);
  }

  if (activity.type === "electricity") {
    const item = ELECTRICITY_CATALOG.find(
      (o) => o.value === activity.sub || o.label.toLowerCase() === (activity.customText || "").toLowerCase()
    );
    const factor = item ? item.factor : estimateCustomElectricityFactor(activity.customText || activity.sub, activity.unit);
    return +(amount * factor).toFixed(2);
  }

  if (activity.type === "devices") {
    const item = DEVICE_CATALOG.find(
      (o) => o.value === activity.sub || o.label.toLowerCase() === (activity.customText || "").toLowerCase()
    );
    const factor = item ? item.factor : estimateCustomDeviceFactor(activity.customText || activity.sub);
    return +(amount * factor).toFixed(2);
  }

  if (activity.type === "food") {
    const matched = (foodOptions || []).find(
      (o) =>
        o.value.toLowerCase() === (activity.sub || "").toLowerCase() ||
        o.name?.toLowerCase() === (activity.customText || "").toLowerCase() ||
        o.label.toLowerCase().startsWith((activity.customText || "").toLowerCase())
    );
    const co2PerServing = matched ? matched.co2 : estimateFoodItemCo2(activity.customText || activity.sub, foodOptions || []);
    return +(amount * (co2PerServing || 0.29)).toFixed(2);
  }

  return 0.50;
}

/* ── Realistic Quick Planning Presets ── */
const presets = [
  {
    id: "commute",
    label: "Typical commute",
    icon: Coffee,
    items: [
      { type: "transport", sub: "car_petrol", customText: "Car (Petrol)", amount: 12, unit: "km", kg: 2.04 },
      { type: "electricity", sub: "fan", customText: "Ceiling Fan (75W)", amount: 4, unit: "hrs", kg: 0.24 },
      { type: "food", sub: "rice", customText: "Rice", amount: 1, unit: "servings", kg: 0.16 },
    ],
  },
  {
    id: "wfh",
    label: "Work from home",
    icon: Home,
    items: [
      { type: "electricity", sub: "ac", customText: "Air Conditioner (1.5 kW)", amount: 3, unit: "hrs", kg: 3.69 },
      { type: "devices", sub: "laptop", customText: "Laptop", amount: 4, unit: "hrs", kg: 0.16 },
      { type: "food", sub: "garden_salad", customText: "Salad", amount: 1, unit: "servings", kg: 0.22 },
    ],
  },
  {
    id: "errands",
    label: "Weekend errands",
    icon: ShoppingCart,
    items: [
      { type: "transport", sub: "car_petrol", customText: "Car (Petrol)", amount: 25, unit: "km", kg: 4.25 },
      { type: "food", sub: "chicken_biryani", customText: "Chicken Biryani", amount: 1, unit: "servings", kg: 1.15 },
    ],
  },
];

const selectStyle = {
  color: "var(--text-primary)",
  background: "var(--bg-secondary)",
};

const Predict = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [foodOptions, setFoodOptions] = useState([]);
  const [activities, setActivities] = useState(() =>
    presets[0].items.map((item) => ({ ...item }))
  );
  const [budget, setBudget] = useState(6.5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeGpsRowIndex, setActiveGpsRowIndex] = useState(null);

  useEffect(() => {
    let active = true;
    getFoodCatalog()
      .then((response) => {
        if (!active) return;
        const options = (response.items || []).map((item) => ({
          label: `${item.label} (${item.co2_kg} kg CO2e)`,
          value: item.value,
          co2: item.co2_kg,
          name: item.label,
        }));
        setFoodOptions(options);
      })
      .catch(() => toast.error("Reviewed food factors could not be loaded"));
    return () => { active = false; };
  }, []);

  const morningTotal = useMemo(
    () => activities.reduce((s, a) => s + (parseFloat(a.kg) || 0), 0),
    [activities]
  );

  const applyPreset = (p) => {
    setActivities(p.items.map((item) => ({ ...item })));
    setResult(null);
  };

  const add = (type) => {
    let defaultItem;
    if (type === "transport") defaultItem = TRANSPORT_CATALOG[0];
    else if (type === "electricity") defaultItem = ELECTRICITY_CATALOG[0];
    else if (type === "devices") defaultItem = DEVICE_CATALOG[0];
    else defaultItem = { value: "rice", label: "Rice", defaultAmount: 1, unit: "servings", factor: 0.16 };

    const newActivity = {
      type,
      sub: defaultItem.value,
      customText: defaultItem.label,
      amount: defaultItem.defaultAmount,
      unit: defaultItem.unit,
      kg: +(defaultItem.defaultAmount * (defaultItem.factor || 0.2)).toFixed(2),
    };
    newActivity.kg = calculateActivityKg(newActivity, foodOptions);
    setActivities([...activities, newActivity]);
  };

  const remove = (i) => setActivities(activities.filter((_, idx) => idx !== i));

  const updateType = (i, type) => {
    let defaultItem;
    if (type === "transport") defaultItem = TRANSPORT_CATALOG[0];
    else if (type === "electricity") defaultItem = ELECTRICITY_CATALOG[0];
    else if (type === "devices") defaultItem = DEVICE_CATALOG[0];
    else defaultItem = { value: "rice", label: "Rice", defaultAmount: 1, unit: "servings", factor: 0.16 };

    setActivities((prev) =>
      prev.map((a, idx) => {
        if (idx !== i) return a;
        const updated = {
          ...a,
          type,
          sub: defaultItem.value,
          customText: defaultItem.label,
          amount: defaultItem.defaultAmount,
          unit: defaultItem.unit,
        };
        updated.kg = calculateActivityKg(updated, foodOptions);
        return updated;
      })
    );
  };

  const updateCustomText = (i, text) => {
    setActivities((prev) =>
      prev.map((a, idx) => {
        if (idx !== i) return a;
        let matchedCatalog;
        if (a.type === "transport") matchedCatalog = TRANSPORT_CATALOG.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.value === text);
        else if (a.type === "electricity") matchedCatalog = ELECTRICITY_CATALOG.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.value === text);
        else if (a.type === "devices") matchedCatalog = DEVICE_CATALOG.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.value === text);
        else if (a.type === "food") matchedCatalog = foodOptions.find((o) => o.name?.toLowerCase() === text.toLowerCase() || o.value === text);

        const updated = {
          ...a,
          customText: text,
          sub: matchedCatalog ? matchedCatalog.value : (text ? `custom_${text.toLowerCase().replace(/\s+/g, "_")}` : a.sub),
          unit: matchedCatalog?.unit || a.unit,
        };
        updated.kg = calculateActivityKg(updated, foodOptions);
        return updated;
      })
    );
  };

  const updateAmount = (i, amount) => {
    setActivities((prev) =>
      prev.map((a, idx) => {
        if (idx !== i) return a;
        const updated = { ...a, amount };
        updated.kg = calculateActivityKg(updated, foodOptions);
        return updated;
      })
    );
  };

  const updateKg = (i, kg) => {
    setActivities((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, kg } : a))
    );
  };

  const run = async () => {
    if (activities.length === 0) {
      toast.error("Add at least one morning activity");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        morning_activities: activities.map((a) => ({
          type: a.type,
          kg: parseFloat(a.kg) || 0,
        })),
        daily_budget_kg: budget,
        observation_hours: 2,
      };
      const r = await predictDay(payload);
      setResult(r);
      setTimeout(() => document.getElementById("predict-result-anchor")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      toast.error("Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const saveToToday = async () => {
    if (!user?.id) {
      toast.error("Please sign in to save activities");
      return;
    }
    if (activities.length === 0) {
      toast.error("Add at least one activity to save");
      return;
    }
    setSaving(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const payload = {
        user_id: user.id,
        day: todayStr,
        append: true,
        activities: activities.map((a) => ({
          type: a.type,
          label: `${a.customText || a.sub} (${a.amount} ${a.unit || ""})`.trim(),
          kg: parseFloat(a.kg) || 0,
          source: "manual_entry",
        })),
      };
      await saveDailyActivities(payload);
      toast.success("Saved all activities to today's record!");
      navigate("/tracker");
    } catch (err) {
      console.error("Failed to save:", err);
      toast.error(err?.response?.data?.detail || "Could not save activities to your record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="predict-root">
      {/* Header */}
      <div className="glass p-4 sm:p-6 lg:p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Day Logger & Planner</div>
            <h2 className="font-display text-2xl sm:text-3xl mt-1">Log & Plan your day</h2>
            <p className="text-sm text-secondary mt-2 max-w-2xl">
              Enter what you did from morning to evening (travel in km, electricity in kWh/hrs, food, devices). Calculate your exact emissions and save them straight to your activity record in one click!
            </p>
          </div>
          <button
            onClick={saveToToday}
            disabled={saving || activities.length === 0}
            className="font-mono-data text-xs px-3.5 py-2 rounded-full bg-green/10 text-green border border-green/30 hover:bg-green/20 transition inline-flex items-center gap-2 font-medium"
            data-testid="header-save-btn"
          >
            <CheckCircle className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save to Today's Record"}
          </button>
        </div>

        {/* Quick presets */}
        <div className="mt-6">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary mb-2">Quick planning scenarios</div>
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
                  {p.items.length} activities · customized km, kWh & meals
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass p-4 sm:p-6 glass-hover lg:col-span-2 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Two-hour planning window</div>
              <div className="font-display text-xl mt-1">Model possible activity</div>
            </div>
            <div className="text-right">
              <div className="font-mono-data text-[10px] text-secondary uppercase tracking-widest">Scenario total</div>
              <div className="font-mono-data text-2xl neon-text-green">{morningTotal.toFixed(2)} <span className="text-sm text-secondary">kg</span></div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {activities.length === 0 && (
              <div className="text-sm text-secondary p-6 text-center border border-dashed border-glass-border rounded-xl">
                Add a scenario item or choose a preset.
              </div>
            )}
            {activities.map((a, i) => {
              const Icon = iconMap[a.type] || Car;
              const color = typeColors[a.type];
              const datalistId = `catalog-${a.type}-${i}`;

              // Determine options for datalist
              let options = [];
              if (a.type === "transport") options = TRANSPORT_CATALOG;
              else if (a.type === "electricity") options = ELECTRICITY_CATALOG;
              else if (a.type === "devices") options = DEVICE_CATALOG;
              else if (a.type === "food") options = foodOptions.length > 0 ? foodOptions : [
                { value: "rice", label: "Rice (1 cup)", name: "Rice" },
                { value: "biryani", label: "Chicken Biryani", name: "Chicken Biryani" },
                { value: "roti", label: "Roti / Chapati", name: "Roti" },
                { value: "salad", label: "Salad", name: "Salad" },
              ];

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-xl bg-widget border border-glass-border transition"
                  data-testid={`activity-row-${i}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}15`, borderColor: `${color}40` }}
                    >
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>

                    <div className="w-full min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      {/* Category - 3 cols */}
                      <div className="sm:col-span-3">
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

                      {/* Sub-item: Type or Select with datalist - 4 cols */}
                      <div className="sm:col-span-4">
                        <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary mb-1">
                          {a.type === "transport" ? "Vehicle / Mode" :
                           a.type === "electricity" ? "Appliance or Grid" :
                           a.type === "food" ? "Food Item" : "Device"}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            list={datalistId}
                            value={a.customText || ""}
                            onChange={(e) => updateCustomText(i, e.target.value)}
                            placeholder={
                              a.type === "transport" ? "Pick or type vehicle..." :
                              a.type === "electricity" ? "Pick or type usage..." :
                              a.type === "food" ? "Pick or type food..." : "Pick or type device..."
                            }
                            className="input-glass !py-2 !px-3 text-sm w-full font-medium"
                            style={selectStyle}
                            data-testid={`activity-sub-${i}`}
                          />
                          <datalist id={datalistId}>
                            {options.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.name || opt.label.split(" (")[0]}
                              >
                                {opt.label}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Quantity / Unit column: km, kWh, hrs, servings - 3 cols */}
                      <div className="sm:col-span-3">
                        <div className="flex items-center justify-between font-mono-data text-[9px] uppercase tracking-widest text-secondary mb-1">
                          <span>
                            {a.type === "transport" ? "Distance" :
                             a.type === "electricity" ? (a.unit === "kWh" ? "Energy" : "Hours") :
                             a.type === "devices" ? "Duration" : "Quantity"}
                          </span>
                          {a.type === "transport" ? (
                            <button
                              onClick={() => setActiveGpsRowIndex(i)}
                              className="text-[9px] text-green flex items-center gap-1 hover:text-[#00FFB2] transition bg-green/10 px-1.5 py-0.5 rounded"
                              title="Auto-detect via GPS"
                            >
                              <Navigation className="h-2.5 w-2.5" /> GPS
                            </button>
                          ) : (
                            <span className="text-secondary text-[8px] tracking-normal font-sans font-medium uppercase">
                              {a.unit || "unit"}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step={a.unit === "servings" ? "1" : "0.5"}
                            min="0"
                            value={a.amount !== undefined ? a.amount : 1}
                            onChange={(e) => updateAmount(i, parseFloat(e.target.value) || 0)}
                            className="input-glass !py-2 !pl-3 !pr-9 text-sm w-full font-mono-data font-medium"
                            style={selectStyle}
                            placeholder={a.type === "transport" ? "km" : a.type === "electricity" ? "kWh/hrs" : "qty"}
                            data-testid={`activity-amount-${i}`}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono-data text-[10px] text-secondary/80 pointer-events-none uppercase font-semibold">
                            {a.unit || (a.type === "transport" ? "km" : "unit")}
                          </span>
                        </div>
                      </div>

                      {/* Auto-calculated CO2e with manual override - 2 cols */}
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between font-mono-data text-[9px] uppercase tracking-widest text-secondary mb-1">
                          <span>CO₂e (kg)</span>
                          <span className="text-green text-[8px] tracking-normal font-sans font-medium">Auto</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={a.kg}
                          onChange={(e) => updateKg(i, parseFloat(e.target.value) || 0)}
                          className="input-glass !py-2 !px-3 text-sm w-full font-mono-data text-green font-semibold"
                          data-testid={`activity-kg-${i}`}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => remove(i)}
                      className="self-end sm:self-auto h-9 w-9 rounded-lg bg-widget border border-glass-border hover:bg-[#FF4D4D]/10 hover:border-[#FF4D4D]/30 hover:text-[#FF4D4D] text-secondary transition flex items-center justify-center"
                      data-testid={`activity-remove-${i}`}
                      title="Remove activity"
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
            {["transport", "electricity", "food", "devices"].map((t) => {
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
            <div className="font-mono-data text-[9px] text-secondary w-full mt-2 opacity-70">
              💡 Tip: Enter exact travel distances in <span className="text-green">km</span> and electricity in <span className="text-cyan">kWh or hours</span>. You can also pick from the list or type any custom item freely!
            </div>
          </div>
        </div>

        {/* Budget + Run */}
        <div className="glass p-4 sm:p-6 glass-hover space-y-5">
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
              <div className="font-mono-data text-[10px] text-secondary">3 kg</div>
              <div className="font-mono-data text-3xl neon-text-green">{budget}<span className="text-sm text-secondary ml-1">kg</span></div>
              <div className="font-mono-data text-[10px] text-secondary">12 kg</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-widget border border-glass-border">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Transparent projection</div>
            <div className="font-mono-data text-lg mt-1 text-main">
              ≈ {(morningTotal * 12).toFixed(2)} <span className="text-xs text-secondary">kg by end of day</span>
            </div>
            <div className="text-[11px] text-secondary mt-1">Scales the observed activity rate to the remaining day.</div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={run}
              disabled={loading}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-3.5"
              data-testid="predict-btn"
            >
              {loading ? "Calculating..." : (<>Project end of day <Sparkles className="h-4 w-4" /></>)}
            </button>

            <button
              onClick={saveToToday}
              disabled={saving || activities.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 !py-3.5 px-4 rounded-xl border border-green/40 bg-green/10 text-green hover:bg-green/20 transition font-medium text-sm"
              data-testid="save-all-to-record-btn"
            >
              {saving ? "Saving to record..." : (<>Save to Today's Record <CheckCircle className="h-4 w-4" /></>)}
            </button>
          </div>
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
          <div className="glass p-4 sm:p-6 glass-hover relative overflow-hidden glow-ring">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${result.exceeds ? "bg-[#FFD166]/10 border border-[#FFD166]/30" : "bg-green/10 border border-green/30"}`}>
                {result.exceeds ? <AlertTriangle className="h-6 w-6 text-[#FFD166]" /> : <TrendingUp className="h-6 w-6 text-green" />}
              </div>
              <div className="flex-1">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Daily projection</div>
                <div className="font-display text-xl sm:text-2xl mt-1 leading-tight">{result.ai_headline}</div>
                <div className="text-xs text-secondary mt-2 max-w-2xl">{result.model_note}</div>
                <div className="text-xs text-green mt-2">This projection has not changed your saved activity record.</div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-xl">
                  <MetricBlock label="Predicted" value={`${result.predicted_full_day_kg} kg`} color="var(--neon-green)" />
                  <MetricBlock label="Budget" value={`${result.budget_kg} kg`} color="var(--text-primary)" />
                  <MetricBlock label="Delta" value={`${result.over_pct > 0 ? "+" : ""}${result.over_pct}%`} color={result.exceeds ? "#FFD166" : "var(--neon-green)"} />
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-4 sm:p-6 glass-hover min-w-0">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// 24-hour projection</div>
            <div className="font-display text-xl mt-1">Predicted emission curve</div>
            <div className="h-[240px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.hourly_curve} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--neon-green)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 12, color: "var(--text-primary)" }} />
                  <ReferenceLine y={result.budget_kg} stroke="#FFD166" strokeDasharray="4 4" label={{ value: "Budget", fill: "#FFD166", fontSize: 10, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="kg" stroke="var(--neon-green)" strokeWidth={2.5} fill="url(#predGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      <GpsCommuteModal
        open={activeGpsRowIndex !== null}
        onClose={() => setActiveGpsRowIndex(null)}
        onDistanceDetected={(dist) => {
          if (activeGpsRowIndex !== null) {
            updateAmount(activeGpsRowIndex, dist);
          }
        }}
      />
    </div>
  );
};

const MetricBlock = ({ label, value, color }) => (
  <div className="bg-widget border border-glass-border rounded-xl p-3">
    <div className="font-mono-data text-[9px] uppercase tracking-widest text-secondary">{label}</div>
    <div className="font-mono-data text-xl mt-1" style={{ color }}>{value}</div>
  </div>
);

export default Predict;
