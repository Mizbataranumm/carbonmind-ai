import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Leaf, Mail, Lock, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/UserContext";
import { demoLogin, registerUser, loginUser } from "@/lib/api";
import AnimatedEarth from "@/components/AnimatedEarth";
import ParticleField from "@/components/ParticleField";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useUser();
  const [mode, setMode] = useState(() => searchParams.get("mode") === "login" ? "login" : "register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const demoRequested = useRef(false);

  const handleDemo = async () => {
    setLoading(true);
    try {
      const u = await demoLogin("Eco Explorer");
      setUser(u);
      toast.success("Demo workspace ready", { description: "This is separate from a personal account." });
      navigate("/dashboard");
    } catch (e) {
      toast.error("Could not start session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("demo") !== "1" || demoRequested.current) return;
    demoRequested.current = true;
    handleDemo();
  }, [searchParams, handleDemo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let u;
      if (mode === "register") {
        u = await registerUser(name, email, password, privacyConsent);
      } else {
        u = await loginUser(email, password);
      }
      setUser(u);
      toast.success("Welcome to CarbonMind", { description: `${u.name} · Aura ${u.grade}` });
      navigate(mode === "register" && !u.onboarding_completed ? "/onboarding" : "/dashboard");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* LEFT visual panel */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center border-r border-glass-border">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <ParticleField count={26} color="mixed" />
        <div className="relative z-10 flex flex-col items-center px-10">
          <AnimatedEarth size={420} />
          <div className="mt-10 max-w-md text-center">
            <div className="font-mono-data text-[11px] uppercase tracking-widest text-green mb-3">// CarbonMind AI</div>
            <h2 className="font-display text-3xl leading-tight">The future is built one habit at a time.</h2>
            <p className="text-secondary mt-4 text-sm leading-relaxed">
              Sign in to access your saved activity record, annual assessment, and planning tools.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-2.5 mb-8 justify-center lg:justify-start">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green to-cyan flex items-center justify-center">
              <Leaf className="h-4 w-4 text-[#071014]" strokeWidth={2.5} />
            </div>
            <div className="font-display font-bold text-lg">CarbonMind</div>
          </div>

          <h1 className="font-display text-3xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-sm text-secondary mt-2">
            {mode === "login" ? "Return to your saved activity record." : "Create a private activity record and lifestyle profile."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            {mode === "register" && (
              <div>
                <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Display name</label>
                <input
                  data-testid="auth-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-glass mt-1"
                  placeholder="Aiko Tanaka"
                />
              </div>
            )}
            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                <input
                  data-testid="auth-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="input-glass pl-10"
                  placeholder="you@earth.io"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                <input
                  data-testid="auth-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="input-glass pl-10"
                  placeholder="••••••••"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {mode === "register" && (
              <label className="flex items-start gap-3 rounded-lg border border-glass-border bg-widget px-3 py-3 text-xs leading-relaxed text-secondary">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(event) => setPrivacyConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#00FFB2]"
                />
                <span>I agree that CarbonMind stores my account, activity record, and lifestyle profile. Food photos are sent to the selected vision provider for analysis and are not retained by CarbonMind.</span>
              </label>
            )}

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading || (mode === "register" && !privacyConsent)}
              className="btn-primary w-full mt-3 inline-flex items-center justify-center gap-2"
            >
              {loading ? "Loading..." : (<>Continue <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>

          <div className="relative my-6">
            <div className="divider" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-app px-3 font-mono-data text-[10px] uppercase tracking-widest text-[#5C6B7A]">or</span>
          </div>

          <button
            data-testid="demo-login-btn"
            onClick={handleDemo}
            disabled={loading}
            className="btn-ghost w-full inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-green" /> Continue as demo eco-explorer
          </button>

          <p className="text-center text-xs text-secondary mt-7">
            {mode === "login" ? "New here? " : "Already onboard? "}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-green hover:underline"
              data-testid="toggle-auth-mode"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
