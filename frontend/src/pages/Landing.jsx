import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, BarChart3, Mic, Globe2, Brain, Leaf, ShieldCheck, Activity } from "lucide-react";
import ParticleField from "@/components/ParticleField";
import AnimatedEarth from "@/components/AnimatedEarth";

const stats = [
  { label: "Avg reduction", value: "−34%", note: "in 90 days" },
  { label: "Active eco-citizens", value: "12.4k", note: "global" },
  { label: "CO₂ saved", value: "284t", note: "this month" },
];

const features = [
  { icon: Brain, title: "AI Sustainability Coach", desc: "Real-time advice powered by Gemini. Ask anything about your habits." },
  { icon: Activity, title: "Live Carbon Tracker", desc: "Granular daily emissions across transport, food, devices and energy." },
  { icon: Sparkles, title: "Future Simulator", desc: "Project your 10-year carbon impact and meet your future self." },
  { icon: Mic, title: "Voice Companion", desc: "Hands-free briefings. Your AI tells you exactly what to fix today." },
  { icon: ShieldCheck, title: "Privacy-aware", desc: "Inspired by CarbonTracker research — your data stays your own." },
  { icon: Globe2, title: "Earth Reaction", desc: "Watch the planet thrive or struggle based on collective behaviour." },
];

const Landing = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-30 pointer-events-none" />

      {/* Top nav */}
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
          <a className="hover:text-main transition" href="#research">Research</a>
          <a className="hover:text-main transition" href="#future">Future</a>
        </div>
        <button data-testid="landing-cta-top" onClick={() => navigate("/auth")} className="btn-ghost text-sm">Launch app</button>
      </nav>

      {/* HERO */}
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
              <span className="font-mono-data text-[11px] uppercase tracking-widest text-secondary">Your Intelligent Carbon Footprint Companion</span>
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
              A futuristic sustainability operating system. Monitor your carbon DNA,
              get AI-powered guidance, and meet the version of yourself that the Earth
              will thank you for.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <button data-testid="start-tracking-btn" onClick={() => navigate("/auth")} className="btn-primary inline-flex items-center gap-2">
                Start Tracking <ArrowRight className="h-4 w-4" />
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
              {stats.map((s) => (
                <div key={s.label} className="glass p-4">
                  <div className="font-mono-data text-2xl neon-text-green font-bold">{s.value}</div>
                  <div className="text-xs text-secondary mt-1">{s.label}</div>
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#5C6B7A] mt-0.5">{s.note}</div>
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
            <div className="animate-float">
              <AnimatedEarth size={460} health={85} />
            </div>
            {/* floating labels */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute top-10 right-0 glass p-3 px-4 hidden md:block"
            >
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Global health</div>
              <div className="font-mono-data text-lg neon-text-green">+12.4 idx</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              className="absolute bottom-12 left-0 glass p-3 px-4 hidden md:block"
            >
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Your aura</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-3 w-3 rounded-full" style={{ background: "var(--neon-green)", boxShadow: "0 0 10px #00FFB2" }} />
                <span className="font-mono-data text-sm">Emerald A−</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative px-6 lg:px-12 py-24 border-t border-glass-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div>
              <div className="font-mono-data text-[11px] uppercase tracking-widest text-green">// Capabilities</div>
              <h2 className="font-display text-4xl sm:text-5xl mt-3 max-w-2xl leading-tight">A complete OS for your sustainability life.</h2>
            </div>
            <p className="text-secondary max-w-md leading-relaxed">
              Inspired by CarbonTracker, EcoTrack and EcoLogic. Built for humans who
              want their habits to align with the planet, without the lectures.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="glass glass-hover p-7 group"
                data-testid={`feature-${i}`}
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#00FFB2]/15 to-[#00D9FF]/10 border border-green/20 flex items-center justify-center mb-5 group-hover:from-[#00FFB2]/25 transition-all">
                  <f.icon className="h-5 w-5 text-green" />
                </div>
                <h3 className="font-display text-xl mb-2">{f.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* RESEARCH */}
      <section id="research" className="relative px-6 lg:px-12 py-24 border-t border-glass-border">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-2">
            <div className="font-mono-data text-[11px] uppercase tracking-widest text-green">// Research foundation</div>
            <h2 className="font-display text-4xl mt-3 leading-tight">Grounded in peer-reviewed sustainability AI.</h2>
            <p className="text-secondary mt-4 leading-relaxed">
              CarbonMind synthesizes ideas from leading research on privacy-aware
              monitoring, behavioural prediction, and human-in-the-loop sustainability
              systems — into one interface.
            </p>
          </div>
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
            {[
              { name: "CarbonTracker", desc: "Per-activity emission attribution." },
              { name: "EcoTrack", desc: "Lifestyle pattern recognition." },
              { name: "EcoLogic", desc: "Recommendation through impact-scoring." },
              { name: "Privacy-AI", desc: "On-device personal data processing." },
            ].map((p) => (
              <div key={p.name} className="glass p-5 glass-hover">
                <div className="font-mono-data text-xs text-cyan mb-1">PAPER</div>
                <div className="font-display text-lg">{p.name}</div>
                <div className="text-sm text-secondary mt-1">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="future" className="relative px-6 lg:px-12 py-28 border-t border-glass-border overflow-hidden">
        <ParticleField count={20} color="cyan" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="font-display text-5xl sm:text-6xl leading-tight">
            Meet the <span className="text-gradient">version of you</span><br />the planet is waiting for.
          </h2>
          <p className="text-secondary mt-6 max-w-xl mx-auto leading-relaxed">
            Step into the simulator. See your 10-year footprint, your future Earth,
            and the small decisions that compound into a different timeline.
          </p>
          <div className="mt-10 flex justify-center">
            <button data-testid="cta-bottom-btn" onClick={() => navigate("/auth")} className="btn-primary inline-flex items-center gap-2 text-base">
              Enter CarbonMind <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-16 flex items-center justify-center gap-2 text-xs text-[#5C6B7A] font-mono-data uppercase tracking-widest">
            <BarChart3 className="h-3 w-3" />
            Phase 1 · Demo Build · 2026
          </div>
        </div>
      </section>

      <footer className="px-6 lg:px-12 py-10 border-t border-glass-border text-sm text-[#5C6B7A] flex flex-wrap justify-between gap-4">
        <div>CarbonMind AI © 2026 — A futuristic sustainability OS.</div>
        <div className="font-mono-data text-[11px] uppercase tracking-widest">v1.0 · demo build</div>
      </footer>
    </div>
  );
};

export default Landing;
