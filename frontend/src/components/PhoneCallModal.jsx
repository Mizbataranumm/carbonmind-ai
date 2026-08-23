import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, X, Loader2, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { triggerPhoneCall } from "@/lib/api";

export default function PhoneCallModal({ open, onClose, userName = "Explorer", weeklyKg = 41.8, topCategory = "Transport" }) {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState("input"); // input | calling | success | demo | error
  const [errorMsg, setErrorMsg] = useState("");
  const [demoScript, setDemoScript] = useState("");

  const todayKg = (weeklyKg / 7).toFixed(1);

  const handleCall = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!phone.trim() || digits.length < 10) {
      setErrorMsg("Please enter a valid phone number with country code (e.g. +91XXXXXXXXXX)");
      return;
    }
    setStep("calling");
    setErrorMsg("");
    try {
      const res = await triggerPhoneCall({
        phone_number: phone.trim(),
        user_name: userName,
        today_kg: parseFloat(todayKg),
        top_category: topCategory,
        weekly_kg: weeklyKg,
      });

      if (res.demo) {
        // Twilio not configured — show demo mode with the script
        setDemoScript(res.script || res.message || "");
        setStep("demo");
      } else {
        setStep("success");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Could not place the call. Please check backend logs.";
      setErrorMsg(msg);
      setStep("error");
    }
  };

  const reset = () => {
    setStep("input");
    setErrorMsg("");
    setDemoScript("");
  };

  const inputStyle = { color: 'var(--text-primary)', background: 'var(--glass-input-bg)' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="border border-glass-border rounded-3xl p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-green/10 blur-3xl rounded-full pointer-events-none" />

            <button
              onClick={() => { reset(); onClose(); }}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
            >
              <X className="h-4 w-4 text-secondary" />
            </button>

            {/* Header */}
            <div className="text-center mb-6 relative z-10">
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-3">// AI Voice Call</div>
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green to-cyan flex items-center justify-center mx-auto mb-4" style={{ boxShadow: "0 0 30px rgba(0,255,178,0.3)" }}>
                <Phone className="h-7 w-7 text-app" />
              </div>
              <h2 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Carbon Voice Call</h2>
              <p className="text-sm text-secondary mt-1">CarbonMind AI calls you with your daily emissions + tips</p>
            </div>

            {/* INPUT STATE */}
            {step === "input" && (
              <div className="space-y-4 relative z-10">
                <div className="rounded-2xl p-3 text-sm space-y-1 border border-glass-border" style={{ background: 'var(--glass-bg)' }}>
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Today's emissions:</span>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{todayKg} kg CO₂</span>
                  </div>
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Top source:</span>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{topCategory}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono-data text-secondary block mb-2 uppercase tracking-widest">Your Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCall()}
                    placeholder="+91 98765 43210"
                    style={inputStyle}
                    className="w-full border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green/60 transition-colors w-full"
                  />
                  <p className="text-xs text-secondary mt-1.5">Include country code (e.g. +91 for India, +1 for USA)</p>
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleCall}
                  disabled={!phone.trim()}
                  className="w-full bg-green text-app font-bold py-3 rounded-xl hover:bg-green/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ boxShadow: '0 0 20px rgba(0,255,178,0.2)' }}
                >
                  <Phone className="h-4 w-4" />
                  Call Me Now
                </button>
              </div>
            )}

            {/* CALLING STATE */}
            {step === "calling" && (
              <div className="flex flex-col items-center py-6 gap-4 relative z-10">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="h-16 w-16 rounded-full border-2 border-green flex items-center justify-center bg-green/10"
                >
                  <Loader2 className="h-8 w-8 text-green animate-spin" />
                </motion.div>
                <div className="text-center">
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Placing your call...</p>
                  <p className="text-sm text-secondary mt-1">Connecting to {phone}</p>
                </div>
              </div>
            )}

            {/* SUCCESS STATE - real Twilio call placed */}
            {step === "success" && (
              <div className="flex flex-col items-center py-6 gap-4 text-center relative z-10">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                  <CheckCircle className="h-16 w-16 text-green" />
                </motion.div>
                <div>
                  <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Call Incoming!</p>
                  <p className="text-sm text-secondary mt-1">CarbonMind AI is calling <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{phone}</span></p>
                  <p className="text-xs text-secondary mt-2">Pick up — the AI will brief you on today's emissions!</p>
                </div>
                <button onClick={() => { reset(); onClose(); }} className="w-full py-3 rounded-xl border border-glass-border text-sm font-medium hover:bg-white/5 transition-colors mt-2" style={{ color: 'var(--text-primary)' }}>
                  Close
                </button>
              </div>
            )}

            {/* DEMO STATE - Twilio not configured */}
            {step === "demo" && (
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center gap-3 bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-4">
                  <Settings className="h-6 w-6 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-yellow-400 text-sm">Twilio Not Configured</p>
                    <p className="text-xs text-secondary mt-0.5">Add credentials to backend/.env to enable real calls</p>
                  </div>
                </div>

                <div className="text-xs font-mono-data text-secondary uppercase tracking-widest mb-1">What the AI would say:</div>
                <div className="rounded-xl border border-glass-border p-3 text-xs text-secondary leading-relaxed max-h-36 overflow-y-auto" style={{ background: 'var(--glass-bg)' }}>
                  {demoScript}
                </div>

                <div className="text-xs text-secondary bg-glass-bg border border-glass-border rounded-xl p-3 space-y-1">
                  <div className="font-bold text-green mb-1">Setup (5 min):</div>
                  <div>1. Go to console.twilio.com → free signup</div>
                  <div>2. Copy Account SID + Auth Token</div>
                  <div>3. Add to <code className="text-green">backend/.env</code></div>
                  <div>4. Restart backend</div>
                </div>

                <button onClick={() => { reset(); onClose(); }} className="w-full py-3 rounded-xl border border-glass-border text-sm font-medium hover:bg-white/5 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  Close
                </button>
              </div>
            )}

            {/* ERROR STATE */}
            {step === "error" && (
              <div className="flex flex-col items-center py-4 gap-4 text-center relative z-10">
                <PhoneOff className="h-12 w-12 text-red-400" />
                <div>
                  <p className="font-bold text-red-400">Call Failed</p>
                  <p className="text-sm text-secondary mt-1">{errorMsg}</p>
                </div>
                <button onClick={reset} className="w-full py-3 rounded-xl border border-glass-border text-sm font-medium hover:bg-white/5 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  Try Again
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
