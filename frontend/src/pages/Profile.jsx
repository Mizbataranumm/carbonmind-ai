import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, CalendarDays, BarChart3, Leaf, Camera, X, Check, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/UserContext";
import { getCarbonStats, getLifestyleProfile, predictAnnualCarbon, saveLifestyleProfile } from "@/lib/api";

// ── 10 preset avatars from user profile photos ─────────────
const PRESET_AVATARS = [
  { id: "avatar_1",  src: "/avatars/profile_avatar_1.png",  label: "Avatar 1" },
  { id: "avatar_2",  src: "/avatars/profile_avatar_2.png",  label: "Avatar 2" },
  { id: "avatar_3",  src: "/avatars/profile_avatar_3.png",  label: "Avatar 3" },
  { id: "avatar_4",  src: "/avatars/profile_avatar_4.png",  label: "Avatar 4" },
  { id: "avatar_5",  src: "/avatars/profile_avatar_5.png",  label: "Avatar 5" },
  { id: "avatar_6",  src: "/avatars/profile_avatar_6.png",  label: "Avatar 6" },
  { id: "avatar_7",  src: "/avatars/profile_avatar_7.png",  label: "Avatar 7" },
  { id: "avatar_8",  src: "/avatars/profile_avatar_8.png",  label: "Avatar 8" },
  { id: "avatar_9",  src: "/avatars/profile_avatar_9.png",  label: "Avatar 9" },
  { id: "avatar_10", src: "/avatars/profile_avatar_10.png", label: "Avatar 10" },
];

const EMPTY_LIFESTYLE_PROFILE = {
  "Body Type": "",
  "Diet": "",
  "How Often Shower": "",
  "Heating Energy Source": "",
  "Transport": "",
  "Vehicle Type": "",
  "Social Activity": "",
  "Monthly Grocery Bill": "",
  "Frequency of Traveling by Air": "",
  "Vehicle Monthly Distance Km": "",
  "Waste Bag Size": "",
  "Waste Bag Weekly Count": "",
  "How Long TV PC Daily Hour": "",
  "How Many New Clothes Monthly": "",
  "How Long Internet Daily Hour": "",
  "Energy efficiency": "",
  "Recycling": "",
  "Cooking_With": "",
};

const LIFESTYLE_SELECT_FIELDS = [
  { key: "Body Type", label: "Body type", options: [["underweight", "Underweight"], ["normal", "Normal"], ["overweight", "Overweight"], ["obese", "Obese"]] },
  { key: "Diet", label: "Diet", options: [["omnivore", "Omnivore"], ["pescatarian", "Pescatarian"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"]] },
  { key: "How Often Shower", label: "Shower frequency", options: [["less frequently", "Less frequently"], ["daily", "Daily"], ["more frequently", "More frequently"], ["twice a day", "Twice a day"]] },
  { key: "Heating Energy Source", label: "Heating energy", options: [["electricity", "Electricity"], ["natural gas", "Natural gas"], ["wood", "Wood"], ["coal", "Coal"]] },
  { key: "Transport", label: "Primary transport", options: [["public", "Public transit"], ["walk/bicycle", "Walk / bicycle"], ["private", "Private vehicle"]] },
  { key: "Vehicle Type", label: "Vehicle fuel", options: [["electric", "Electric"], ["hybrid", "Hybrid"], ["lpg", "LPG"], ["diesel", "Diesel"], ["petrol", "Petrol"]] },
  { key: "Social Activity", label: "Social activity", options: [["never", "Never"], ["sometimes", "Sometimes"], ["often", "Often"]] },
  { key: "Frequency of Traveling by Air", label: "Air travel", options: [["never", "Never"], ["rarely", "Rarely"], ["frequently", "Frequently"], ["very frequently", "Very frequently"]] },
  { key: "Waste Bag Size", label: "Waste bag size", options: [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["extra large", "Extra large"]] },
  { key: "Energy efficiency", label: "Energy efficiency", options: [["No", "No"], ["Sometimes", "Sometimes"], ["Yes", "Yes"]] },
];

const LIFESTYLE_NUMBER_FIELDS = [
  { key: "Monthly Grocery Bill", label: "Monthly grocery bill", min: 0, max: 10000, step: 1 },
  { key: "Vehicle Monthly Distance Km", label: "Vehicle distance / month (km)", min: 0, max: 30000, step: 1 },
  { key: "Waste Bag Weekly Count", label: "Waste bags / week", min: 0, max: 50, step: 1 },
  { key: "How Long TV PC Daily Hour", label: "TV / PC hours daily", min: 0, max: 24, step: 0.5 },
  { key: "How Many New Clothes Monthly", label: "New clothes / month", min: 0, max: 100, step: 1 },
  { key: "How Long Internet Daily Hour", label: "Internet hours daily", min: 0, max: 24, step: 0.5 },
];

const RECYCLING_OPTIONS = ["Paper", "Plastic", "Glass", "Metal"];
const COOKING_OPTIONS = ["Stove", "Oven", "Microwave", "Grill", "Airfryer"];

const formatListValue = (values) => values.length ? `[${values.map((value) => `'${value}'`).join(", ")}]` : "[]";
const listValues = (value, options) => options.filter((option) => String(value || "").includes(`'${option}'`));

// ── Avatar Picker modal ───────────────────────────────────────────────────
function AvatarPickerModal({ current, onSelect, onClose }) {
  const [hovered, setHovered] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="border border-glass-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
        style={{ background: "var(--bg-secondary)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-0.5">// Choose Avatar</div>
            <div className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
              Pick Your Look
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl bg-widget border border-glass-border flex items-center justify-center hover:bg-widget-hover transition-colors">
            <X className="h-4 w-4 text-secondary" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-3">
          {PRESET_AVATARS.map(av => {
            const isSelected = current === av.src;
            return (
              <button
                key={av.id}
                onClick={() => { onSelect(av.src); onClose(); }}
                onMouseEnter={() => setHovered(av.id)}
                onMouseLeave={() => setHovered(null)}
                className="relative group flex flex-col items-center gap-1.5 focus:outline-none"
              >
                <div className={`relative h-16 w-16 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-green shadow-[0_0_16px_rgba(0,255,178,0.5)] scale-105"
                    : hovered === av.id
                      ? "border-cyan/60 scale-105"
                      : "border-glass-border"
                }`}>
                  <img
                    src={av.src}
                    alt={av.label}
                    className="w-full h-full object-cover"
                    style={{ background: "var(--glass-bg)" }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-green/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green drop-shadow" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Upload own */}
        <div className="mt-5 pt-4 border-t border-glass-border">
          <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-glass-border text-sm font-medium text-secondary hover:text-main hover:border-green/40 hover:bg-green/5 transition-all cursor-pointer">
            <Camera className="h-4 w-4" />
            Upload your own photo
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => { onSelect(ev.target.result); onClose(); };
              reader.readAsDataURL(file);
            }} />
          </label>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Profile Page ─────────────────────────────────────────────────────
const Profile = () => {
  const { user, setUser } = useUser();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [lifestyleProfile, setLifestyleProfile] = useState(EMPTY_LIFESTYLE_PROFILE);
  const [annualResult, setAnnualResult] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getCarbonStats(user.id).then(setStats).catch(() => setStats(null));
    getLifestyleProfile(user.id)
      .then(({ lifestyle_profile: savedProfile }) => {
        if (savedProfile && Object.keys(savedProfile).length) {
          setLifestyleProfile((current) => ({ ...current, ...savedProfile }));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  if (!user) return null;

  const handleAvatarSelect = (src) => {
    setUser({ ...user, avatar: src });
  };

  const recordedDays = stats?.activity_days || 0;
  const dailyAverage = recordedDays ? (stats.year_kg / recordedDays).toFixed(1) : "0.0";
  const lifestyleProfileComplete = Object.values(lifestyleProfile).every(
    (value) => value !== "" && value !== null && value !== undefined,
  );
  const setProfileValue = (key, value) => setLifestyleProfile((current) => ({ ...current, [key]: value }));

  const toggleListValue = (key, option, options) => {
    const selected = listValues(lifestyleProfile[key], options);
    const next = selected.includes(option)
      ? selected.filter((value) => value !== option)
      : options.filter((value) => selected.includes(value) || value === option);
    setProfileValue(key, formatListValue(next));
  };

  const estimateAnnualCarbon = async () => {
    setEstimating(true);
    try {
      const result = await predictAnnualCarbon({ lifestyle_profile: lifestyleProfile });
      setAnnualResult(result);
      toast.success("Annual estimate ready");
    } catch (error) {
      toast.error(error?.response?.data?.detail?.message || "Could not calculate the annual estimate");
    } finally {
      setEstimating(false);
    }
  };

  const persistLifestyleProfile = async () => {
    setSavingProfile(true);
    try {
      await saveLifestyleProfile({ user_id: user.id, lifestyle_profile: lifestyleProfile });
      setUser({ ...user, lifestyle_profile: lifestyleProfile });
      toast.success("Lifestyle profile saved");
    } catch (error) {
      toast.error(error?.response?.data?.detail?.message || "Could not save the lifestyle profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {pickerOpen && (
          <AvatarPickerModal
            current={user.avatar}
            onSelect={handleAvatarSelect}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Profile Hero Card ─────────────────────────────────────────── */}
      <div className="glass p-4 sm:p-6 lg:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-green/20 to-transparent" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with click-to-change */}
          <div className="relative group">
            <button
              onClick={() => setPickerOpen(true)}
              className="relative h-28 w-28 rounded-full focus:outline-none"
              aria-label="Change avatar"
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="h-28 w-28 rounded-full object-cover border-4 group-hover:brightness-75 transition-all"
                style={{ borderColor: "var(--app-bg)", background: "var(--glass-bg)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <div className="flex flex-col items-center gap-1">
                  <Camera className="h-7 w-7 text-white drop-shadow-lg" />
                  <span className="text-white text-[10px] font-bold drop-shadow">Change</span>
                </div>
              </div>
            </button>

            {/* Rotating ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
              className="absolute -inset-2 rounded-full border border-dashed border-green/40 pointer-events-none"
            />

            {/* Carbon aura dot */}
            <div
              className="absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-app z-20"
              style={{ background: user.carbon_aura, boxShadow: `0 0 15px ${user.carbon_aura}` }}
            />
          </div>

          {/* Name & grade */}
          <div className="flex-1 text-center sm:text-left mt-2">
            <h1 className="font-display text-3xl font-bold">{user.name}</h1>
            <div className="font-mono-data text-secondary mt-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20 text-xs">
                Grade {stats?.grade || "Newbie"}
              </span>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="mt-3 text-xs font-mono-data text-cyan px-3 py-1.5 rounded-lg bg-cyan/10 hover:bg-cyan/20 border border-cyan/20 transition-all"
            >
              ✏ Change Avatar
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-8 pt-8 border-t border-glass-border">
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <CalendarDays className="h-5 w-5 text-[#FFD166]" />
            </div>
            <div className="font-mono-data text-xl font-bold">{recordedDays}</div>
            <div className="text-xs text-secondary mt-1">Recorded days</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <BarChart3 className="h-5 w-5 text-cyan" />
            </div>
            <div className="font-mono-data text-xl font-bold">{stats?.month_kg ?? 0}<span className="text-xs">kg</span></div>
            <div className="text-xs text-secondary mt-1">This month</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-widget text-secondary mb-2">
              <Leaf className="h-5 w-5 text-green" />
            </div>
            <div className="font-mono-data text-xl font-bold">
              {dailyAverage}<span className="text-xs">kg</span>
            </div>
            <div className="text-xs text-secondary mt-1">Logged-day avg</div>
          </div>
        </div>
      </div>

      {/* ── Preset avatar gallery ─────────────────────────────────────── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-0.5">// Avatar Gallery</div>
            <div className="font-display font-bold text-base" style={{ color: "var(--text-primary)" }}>Choose your character</div>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 border border-green/20 transition-all"
          >
            See all →
          </button>
        </div>

        <div className="grid grid-cols-5 place-items-center gap-3 sm:gap-4 max-w-sm mx-auto">
          {PRESET_AVATARS.map(av => {
            const isSelected = user.avatar === av.src;
            return (
              <button
                key={av.id}
                onClick={() => handleAvatarSelect(av.src)}
                className="relative h-12 w-12 sm:h-14 sm:w-14 group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-app rounded-full"
                title={av.label}
                aria-label={`Choose ${av.label}`}
              >
                <div className={`h-full w-full rounded-full overflow-hidden border-2 transition-colors duration-200 ${
                  isSelected
                    ? "border-green ring-2 ring-green/30 shadow-[0_0_14px_rgba(0,255,178,0.35)]"
                    : "border-glass-border hover:border-cyan/50"
                }`}>
                  <img
                    src={av.src}
                    alt={av.label}
                    className="w-full h-full object-cover"
                    style={{ background: "var(--glass-bg)" }}
                  />
                </div>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green flex items-center justify-center border-2 border-app">
                    <Check className="h-3 w-3 text-app" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="glass p-4 sm:p-6" aria-labelledby="annual-profile-heading">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Annual lifestyle assessment</div>
            <h2 id="annual-profile-heading" className="font-display text-xl mt-1">Annual carbon estimate</h2>
          </div>
          {annualResult && (
            <div className="sm:text-right">
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Annual estimate</div>
              <div className="font-mono-data text-2xl text-green">{annualResult.annual_kg_co2e}<span className="text-sm text-secondary ml-1">kg CO2e</span></div>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LIFESTYLE_SELECT_FIELDS.map((field) => (
            <label key={field.key} className="min-w-0">
              <span className="block font-mono-data text-[10px] uppercase tracking-widest text-secondary mb-1.5">{field.label}</span>
              <select
                value={lifestyleProfile[field.key]}
                onChange={(event) => setProfileValue(field.key, event.target.value)}
                className="input-glass w-full !py-2.5"
              >
                <option value="" disabled>Select an option</option>
                {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
          {LIFESTYLE_NUMBER_FIELDS.map((field) => (
            <label key={field.key} className="min-w-0">
              <span className="block font-mono-data text-[10px] uppercase tracking-widest text-secondary mb-1.5">{field.label}</span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={lifestyleProfile[field.key]}
                onChange={(event) => setProfileValue(field.key, event.target.value === "" ? "" : Number(event.target.value))}
                className="input-glass w-full !py-2.5"
              />
            </label>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mt-5">
          <MultiChoice
            label="Recycling"
            options={RECYCLING_OPTIONS}
            selected={listValues(lifestyleProfile.Recycling, RECYCLING_OPTIONS)}
            noneSelected={lifestyleProfile.Recycling === "[]"}
            onToggle={(option) => toggleListValue("Recycling", option, RECYCLING_OPTIONS)}
            onToggleNone={() => setProfileValue("Recycling", lifestyleProfile.Recycling === "[]" ? "" : "[]")}
          />
          <MultiChoice
            label="Cooking equipment"
            options={COOKING_OPTIONS}
            selected={listValues(lifestyleProfile.Cooking_With, COOKING_OPTIONS)}
            noneSelected={lifestyleProfile.Cooking_With === "[]"}
            onToggle={(option) => toggleListValue("Cooking_With", option, COOKING_OPTIONS)}
            onToggleNone={() => setProfileValue("Cooking_With", lifestyleProfile.Cooking_With === "[]" ? "" : "[]")}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 pt-5 border-t border-glass-border">
          <div className="text-xs text-secondary leading-relaxed max-w-xl">
            {annualResult?.model_note || (lifestyleProfileComplete
              ? "Use your current habits to calculate an annual lifestyle estimate."
              : "Complete all fields to calculate an annual lifestyle estimate.")}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={persistLifestyleProfile}
              disabled={savingProfile || !lifestyleProfileComplete}
              className="btn-ghost px-4 inline-flex items-center justify-center"
            >
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
            <button
              type="button"
              onClick={estimateAnnualCarbon}
              disabled={estimating || !lifestyleProfileComplete}
              className="btn-primary px-4 inline-flex items-center justify-center gap-2"
            >
              <Calculator className="h-4 w-4" /> {estimating ? "Calculating..." : "Estimate"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Settings & Account ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="font-display text-xl ml-2">Preferences</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <SettingRow
              icon={Camera}
              title="Change Avatar"
              desc="Pick from presets or upload your own"
              action={
                <button
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 transition"
                >
                  Open Picker
                </button>
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-xl ml-2">Account</h2>
          <div className="glass rounded-2xl overflow-hidden p-6 text-center space-y-4">
            <p className="text-sm text-secondary">
              Signed in as{" "}
              <strong className="text-main break-all">{user.email || user.name}</strong>.
            </p>
            <button
              onClick={() => { setUser(null); window.location.href = "/"; }}
              className="btn-ghost w-full flex items-center justify-center gap-2 !text-red-400 hover:!bg-red-400/10 hover:!border-red-400/30"
            >
              <LogOut className="h-4 w-4" /> Sign out completely
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MultiChoice = ({ label, options, selected, noneSelected, onToggle, onToggleNone }) => (
  <fieldset className="border border-glass-border rounded-xl p-3 min-w-0">
    <legend className="px-1 font-mono-data text-[10px] uppercase tracking-widest text-secondary">{label}</legend>
    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
      {options.map((option) => (
        <label key={option} className="inline-flex items-center gap-2 text-sm text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            className="h-4 w-4 accent-[#00FFB2]"
          />
          <span>{option}</span>
        </label>
      ))}
      <label className="inline-flex items-center gap-2 text-sm text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={noneSelected}
          onChange={onToggleNone}
          className="h-4 w-4 accent-[#00FFB2]"
        />
        <span>None</span>
      </label>
    </div>
  </fieldset>
);

const SettingRow = ({ icon: Icon, title, desc, active, action, onClick }) => (
  <div className="flex items-center justify-between gap-3 p-4 border-b border-glass-border last:border-0 hover:bg-widget transition">
    <div className="flex items-center gap-4 min-w-0">
      <div className="h-10 w-10 rounded-xl bg-widget flex items-center justify-center border border-glass-border">
        <Icon className="h-5 w-5 text-secondary" />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-secondary mt-0.5">{desc}</div>
      </div>
    </div>
    {action ? (
      typeof action === "string" ? (
        <button className="text-xs font-mono-data text-green px-3 py-1.5 rounded-lg bg-green/10 hover:bg-green/20 transition">
          {action}
        </button>
      ) : action
    ) : (
      <div
        onClick={onClick}
        className={`h-6 w-11 rounded-full p-1 transition-colors cursor-pointer ${
          active ? "bg-green" : "bg-widget border border-glass-border"
        }`}
      >
        <div className={`h-4 w-4 rounded-full bg-white transition-transform ${active ? "translate-x-5" : "translate-x-0 bg-secondary"}`} />
      </div>
    )}
  </div>
);

export default Profile;
