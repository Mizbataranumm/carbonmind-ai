import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, PhoneCall, Volume2, Mic } from "lucide-react";
import { getVoiceTips } from "@/lib/api";

const VoiceCallModal = ({ open, onClose, userName = "there", weeklyKg = 41.8, topCategory = "Transport" }) => {
  const [phase, setPhase] = useState("ringing"); // ringing | connected | ended
  const [tips, setTips] = useState(null);
  const [caption, setCaption] = useState("");
  const [timer, setTimer] = useState(0);
  const utterRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPhase("ringing");
    setCaption("");
    setTimer(0);
    setTips(null);
    // Fetch tips in background
    getVoiceTips({ weekly_kg: weeklyKg, top_category: topCategory, user_name: userName })
      .then(setTips)
      .catch(() => setTips({
        greeting: `Hey ${userName}, it's CarbonMind calling in.`,
        body: `You emitted ${weeklyKg} kg CO₂ this week — ${topCategory} was your biggest source.`,
        tips: [
          "Swap two car trips with cycling this week.",
          "Unplug idle devices — standby power adds up.",
          "Try three plant-based dinners for a quick win.",
        ],
        signoff: "You've got this. I'll check in next week.",
      }));
    return () => stopEverything();
    // eslint-disable-next-line
  }, [open]);

  const stopEverything = () => {
    if (utterRef.current) {
      window.speechSynthesis?.cancel();
      utterRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const accept = () => {
    if (!tips) return;
    setPhase("connected");
    // Start call timer
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    // Build a captioned voice pipeline
    const parts = [
      { text: tips.greeting, caption: tips.greeting },
      { text: tips.body, caption: tips.body },
      { text: "Here are three quick tips.", caption: "Here are three quick tips." },
      { text: `Tip one: ${tips.tips[0]}`, caption: `Tip 1 → ${tips.tips[0]}` },
      { text: `Tip two: ${tips.tips[1]}`, caption: `Tip 2 → ${tips.tips[1]}` },
      { text: `Tip three: ${tips.tips[2]}`, caption: `Tip 3 → ${tips.tips[2]}` },
      { text: tips.signoff, caption: tips.signoff },
    ];
    let idx = 0;
    const playNext = () => {
      if (idx >= parts.length) {
        setPhase("ended");
        stopEverything();
        return;
      }
      const p = parts[idx++];
      setCaption(p.caption);
      const u = new SpeechSynthesisUtterance(p.text);
      u.rate = 1.02;
      u.pitch = 1.05;
      u.onend = () => setTimeout(playNext, 350);
      u.onerror = () => setTimeout(playNext, 300);
      utterRef.current = u;
      window.speechSynthesis?.speak(u);
    };
    setTimeout(playNext, 400);
  };

  const decline = () => {
    stopEverything();
    setPhase("ended");
    setTimeout(onClose, 400);
  };

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          data-testid="voice-call-modal"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#071014]/90 backdrop-blur-2xl" onClick={phase === "ended" ? onClose : undefined} />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            <div className="glass p-8 text-center relative overflow-hidden glow-ring">
              {/* Ripple background when ringing */}
              {phase === "ringing" && (
                <>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="absolute left-1/2 top-[130px] -translate-x-1/2 rounded-full border border-[#00FFB2]/30 pointer-events-none"
                      initial={{ width: 100, height: 100, opacity: 0.6 }}
                      animate={{ width: 340, height: 340, opacity: 0 }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
                    />
                  ))}
                </>
              )}

              <div className="relative">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2] mb-2">
                  {phase === "ringing" && "// Incoming AI Call · Weekly Briefing"}
                  {phase === "connected" && "// Call connected · CarbonMind AI"}
                  {phase === "ended" && "// Call ended"}
                </div>

                <div className="relative mx-auto h-32 w-32 my-4">
                  <motion.div
                    animate={phase === "connected" ? { scale: [1, 1.1, 1] } : phase === "ringing" ? { rotate: [-8, 8, -8] } : { scale: 1 }}
                    transition={phase === "connected" ? { repeat: Infinity, duration: 1.4 } : { repeat: Infinity, duration: 0.6 }}
                    className="h-32 w-32 rounded-full bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] flex items-center justify-center"
                    style={{ boxShadow: "0 0 60px rgba(0,255,178,0.4)" }}
                  >
                    {phase === "connected" ? (
                      <Volume2 className="h-14 w-14 text-[#071014]" />
                    ) : (
                      <PhoneCall className="h-14 w-14 text-[#071014]" />
                    )}
                  </motion.div>
                </div>

                <div className="font-display text-2xl mt-4">CarbonMind AI</div>
                <div className="font-mono-data text-xs text-[#9EABBC] mt-1">
                  {phase === "ringing" && "Weekly sustainability check-in"}
                  {phase === "connected" && (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00FFB2] animate-pulse" style={{ boxShadow: "0 0 8px #00FFB2" }} />
                      {fmtTime(timer)}
                    </span>
                  )}
                  {phase === "ended" && "Briefing complete"}
                </div>

                {/* Caption */}
                {phase === "connected" && caption && (
                  <motion.div
                    key={caption}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-[#cfd8e0] leading-relaxed min-h-[60px] flex items-center justify-center"
                    data-testid="call-caption"
                  >
                    {caption}
                  </motion.div>
                )}

                {phase === "ended" && (
                  <div className="mt-5 text-sm text-[#9EABBC]">Tap outside or close to dismiss.</div>
                )}

                {/* Buttons */}
                {phase === "ringing" && (
                  <div className="mt-7 flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center gap-6">
                      <button
                        onClick={decline}
                        className="h-14 w-14 rounded-full bg-[#FF4D4D] flex items-center justify-center hover:scale-105 transition"
                        style={{ boxShadow: "0 0 20px rgba(255,77,77,0.4)" }}
                        data-testid="call-decline-btn"
                      >
                        <PhoneOff className="h-6 w-6 text-white" />
                      </button>
                      <button
                        onClick={accept}
                        disabled={!tips}
                        className="h-14 w-14 rounded-full bg-[#00FFB2] flex items-center justify-center hover:scale-105 transition disabled:opacity-50"
                        style={{ boxShadow: "0 0 20px rgba(0,255,178,0.55)" }}
                        data-testid="call-accept-btn"
                      >
                        <Phone className="h-6 w-6 text-[#071014]" />
                      </button>
                    </div>
                    {!tips && (
                      <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#9EABBC] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00FFB2] animate-pulse" />
                        Preparing personalized briefing...
                      </div>
                    )}
                  </div>
                )}

                {phase === "connected" && (
                  <div className="mt-6 flex items-center justify-center">
                    <button
                      onClick={decline}
                      className="h-12 w-12 rounded-full bg-[#FF4D4D] flex items-center justify-center hover:scale-105 transition"
                      style={{ boxShadow: "0 0 20px rgba(255,77,77,0.4)" }}
                      data-testid="call-end-btn"
                    >
                      <PhoneOff className="h-5 w-5 text-white" />
                    </button>
                  </div>
                )}

                {phase === "ended" && (
                  <button onClick={onClose} className="btn-ghost mt-6 text-sm" data-testid="call-close-btn">Close</button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceCallModal;
