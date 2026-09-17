import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Leaf, ArrowRight, Sparkles, BarChart3, Mic, Globe2, Brain, ShieldCheck, Activity, Sun, Moon } from "lucide-react";
import ParticleField from "@/components/ParticleField";
import AnimatedEarth from "@/components/AnimatedEarth";
import { useUser } from "@/lib/UserContext";

const stats = [
  { label: "Meal check", value: "Photo + name", note: "before logging" },
  { label: "Activity record", value: "Your entries", note: "saved privately" },
  { label: "Planning", value: "No auto-save", note: "separate from records" },
];

const features = [
  { icon: Brain, title: "Food verification", desc: "Confirm a meal photo and dish name before it becomes part of your record." },
  { icon: Activity, title: "Activity history", desc: "Review completed transport, food, devices, and electricity activities in one place." },
  { icon: Sparkles, title: "Future scenarios", desc: "Compare transparent lifestyle assumptions across a chosen time horizon." },
  { icon: Mic, title: "Daily audio brief", desc: "Hear a one-way summary based on the activities you have actually saved." },
  { icon: ShieldCheck, title: "Account-based record", desc: "Your dashboard is derived from the activities saved to your account." },
  { icon: Globe2, title: "Scenario visual", desc: "Use the visual context to explore choices without treating it as a climate forecast." },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, theme, toggleTheme } = useUser();
  const enterApp = () => navigate(user ? "/dashboard" : "/auth");

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-30 pointer-events-none" />

      <nav className="relative z-20 px-6 lg:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green to-cyan flex items-center justify-center">
            <Leaf className="h-4 w-4 text-[#071014]" strokeWidth={2.5} />
          </div>
          <div className="font-display font-bold text-lg">CarbonMind</div>
          <span className="font-mono-data text-[10px] uppercase tracking-widest text-green border border-green/30 px-1.5 py-0.5 rounded">AI</span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm text-secondary">
          <a className="hover:text-main transition" href="#features">Features</a>
          <a className="hover:text-main transition" href="#research">How it works</a>
          <a className="hover:text-main transition" href="#future">Future</a>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-full bg-widget border border-glass-border flex items-center justify-center hover:bg-widget-hover transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-secondary" /> : <Moon className="h-4 w-4 text-secondary" />}
          </button>
          <button data-testid="landing-cta-top" onClick={enterApp} className="btn-ghost text-sm">{user ? "Open dashboard" : "Launch app"}</button>
        </div>
      </nav>

      <section className="relative px-6 lg:px-12 pt-10 lg:pt-20 pb-32">
        <ParticleField count={32} color="mixed" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-7"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green" style={{ boxShadow: "0 0 10px #00FFB2" }} />
              <span className="font-mono-data text-[11px] uppercase tracking-widest text-secondary">Your personal carbon footprint companion</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05 }}
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight"
            >
              Track your<br />
              <span className="text-gradient">Carbon Future.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 text-secondary text-lg max-w-xl leading-relaxed"
            >
              Build a useful record from your completed choices, verify meals before logging, and use transparent planning tools to explore what comes next.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <button data-testid="start-tracking-btn" onClick={enterApp} className="btn-primary inline-flex items-center gap-2">
                {user ? "Open dashboard" : "Start Tracking"} <ArrowRight className="h-4 w-4" />
              </button>
              <button data-testid="explore-demo-btn" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="btn-ghost inline-flex items-center gap-2">
                Explore the system
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.5 }}
              className="mt-12 grid grid-cols-3 gap-4 max-w-lg"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="glass p-4">
                  <div className="font-mono-data text-sm sm:text-lg neon-text-green font-bold break-words">{stat.value}</div>
                  <div className="text-xs text-secondary mt-1">{stat.label}</div>
                  <div className="font-mono-data text-[9px] uppercase tracking-widest text-[#5C6B7A] mt-0.5">{stat.note}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <div className="animate-float"><AnimatedEarth size={460} health={85} /></div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute top-10 right-0 glass p-3 px-4 hidden md:block"
            >
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Saved record</div>
              <div className="font-mono-data text-lg neon-text-green">Your choices</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              className="absolute bottom-12 left-0 glass p-3 px-4 hidden md:block"
            >
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Planning mode</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-3 w-3 rounded-full" style={{ background: "var(--neon-green)", boxShadow: "0 0 10px #00FFB2" }} />
                <span className="font-mono-data text-sm">No auto-save</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="relative px-6 lg:px-12 py-24 border-t border-glass-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div>
              <div className="font-mono-data text-[11px] uppercase tracking-widest text-green">// Capabilities</div>
              <h2 className="font-display text-4xl sm:text-5xl mt-3 max-w-2xl leading-tight">A complete home for your daily carbon record.</h2>
            </div>
            <p className="text-secondary max-w-md leading-relaxed">Designed around confirmed records and clear assumptions, so the app does not turn guesses into facts.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="glass glass-hover p-7 group"
                data-testid={`feature-${index}`}
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#00FFB2]/15 to-[#00D9FF]/10 border border-green/20 flex items-center justify-center mb-5 group-hover:from-[#00FFB2]/25 transition-all">
                  <feature.icon className="h-5 w-5 text-green" />
                </div>
                <h3 className="font-display text-xl mb-2">{feature.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="research" className="relative px-6 lg:px-12 py-24 border-t border-glass-border">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-2">
            <div className="font-mono-data text-[11px] uppercase tracking-widest text-green">// How it works</div>
            <h2 className="font-display text-4xl mt-3 leading-tight">Useful feedback begins with a reliable record.</h2>
            <p className="text-secondary mt-4 leading-relaxed">CarbonMind separates confirmed activity records, food estimates, planning scenarios, and candidate models so you can understand what each result means.</p>
          </div>
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
            {[
              { name: "Verify", desc: "Confirm a food image and dish before logging its estimate." },
              { name: "Record", desc: "Save completed activities to build your daily history." },
              { name: "Plan", desc: "Explore end-of-day and long-term scenarios separately." },
              { name: "Review", desc: "See the assumptions and limits behind calculated results." },
            ].map((item) => (
              <div key={item.name} className="glass p-5 glass-hover">
                <div className="font-mono-data text-xs text-cyan mb-1">WORKFLOW</div>
                <div className="font-display text-lg">{item.name}</div>
                <div className="text-sm text-secondary mt-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="future" className="relative px-6 lg:px-12 py-28 border-t border-glass-border overflow-hidden">
        <ParticleField count={20} color="cyan" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="font-display text-5xl sm:text-6xl leading-tight">Start with the <span className="text-gradient">choices you make</span><br />today.</h2>
          <p className="text-secondary mt-6 max-w-xl mx-auto leading-relaxed">Create your record, check a meal, or explore a scenario. The app keeps each of those jobs clear and separate.</p>
          <div className="mt-10 flex justify-center">
            <button data-testid="cta-bottom-btn" onClick={enterApp} className="btn-primary inline-flex items-center gap-2 text-base">{user ? "Open CarbonMind" : "Enter CarbonMind"} <ArrowRight className="h-4 w-4" /></button>
          </div>
          <div className="mt-16 flex items-center justify-center gap-2 text-xs text-[#5C6B7A] font-mono-data uppercase tracking-widest"><BarChart3 className="h-3 w-3" /> Personal record · Planning tools · Candidate build</div>
        </div>
      </section>

      <footer className="px-6 lg:px-12 py-10 border-t border-glass-border text-sm text-[#5C6B7A] flex flex-wrap justify-between gap-4">
        <div>CarbonMind AI © 2026</div>
        <div className="font-mono-data text-[11px] uppercase tracking-widest">Track · Analyze · Reduce</div>
      </footer>
    </div>
  );
}
