import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Mic, Leaf, TrendingDown, Lightbulb, CheckCircle } from "lucide-react";

// Voice Brief - auto-narrates today emission summary + tips via browser TTS
const VoiceCallModal = ({ open, onClose, userName = "Explorer", weeklyKg = 41.8, topCategory = "Transport" }) => {
  const [speaking, setSpeaking] = useState(false);
  const [done, setDone] = useState(false);
  const [caption, setCaption] = useState("");
  const [currentPart, setCurrentPart] = useState(0);
  const utterRef = useRef(null);
  const partsRef = useRef([]);
  const isCancelled = useRef(false);

  const todayKg = (weeklyKg / 7).toFixed(1);
  const budget = 6.5;
  const overUnder = todayKg > budget ? "over" : "under";
  const diff = Math.abs((todayKg - budget)).toFixed(1);

  const tips = [
    "Try cycling or walking for trips under 2km.",
    "Switch off devices fully instead of leaving them on standby.",
    "One plant-based meal today can save up to 2.5 kg of CO2.",
  ];

  const buildScript = () => [
    { text: `Hey ${userName}! Here is your CarbonMind daily briefing.`, icon: "wave" },
    { text: `Today you emitted approximately ${todayKg} kilograms of CO2. Your daily budget is ${budget} kilograms. You are ${diff} kg ${overUnder} budget.`, icon: "chart" },
    { text: `Your biggest emission source today is ${topCategory}. This is where you can make the most impact.`, icon: "source" },
    { text: `Tip 1: ${tips[0]}`, icon: "tip" },
    { text: `Tip 2: ${tips[1]}`, icon: "tip" },
    { text: `Tip 3: ${tips[2]}`, icon: "tip" },
    { text: `Great effort today, ${userName}. Every small action counts. See you tomorrow!`, icon: "done" },
  ];

  const stopAll = () => {
    isCancelled.current = true;
    window.speechSynthesis?.cancel();
    utterRef.current = null;
    setSpeaking(false);
  };

  useEffect(() => {
    if (!open) {
      stopAll();
      setDone(false);
      setCaption("");
      setCurrentPart(0);
      return;
    }
    // Auto-start briefing when modal opens
    isCancelled.current = false;
    const script = buildScript();
    partsRef.current = script;
    setSpeaking(true);
    setDone(false);
    setCurrentPart(0);

    let idx = 0;
    const playNext = () => {
      if (isCancelled.current) return;
      if (idx >= script.length) {
        setSpeaking(false);
        setDone(true);
        return;
      }
      const part = script[idx];
      setCaption(part.text);
      setCurrentPart(idx);
      idx++;

      const u = new SpeechSynthesisUtterance(part.text);
      u.rate = 1.0;
      u.pitch = 1.05;
      u.volume = 1.0;
      // Try to use a natural voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang.startsWith("en")) || null;
      if (preferred) u.voice = preferred;

      u.onend = () => setTimeout(playNext, 400);
      u.onerror = () => setTimeout(playNext, 300);
      utterRef.current = u;
      window.speechSynthesis?.speak(u);
    };

    // Small delay to allow voices to load
    setTimeout(playNext, 600);
    return () => stopAll();
    // eslint-disable-next-line
  }, [open]);

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis?.pause();
      setSpeaking(false);
    } else {
      window.speechSynthesis?.resume();
      setSpeaking(true);
    }
  };

  const totalParts = buildScript().length;
  const progress = totalParts > 0 ? Math.round((currentPart / totalParts) * 100) : 0;

  const icons = {
    wave: <Mic className="h-7 w-7 text-green" />,
    chart: <TrendingDown className="h-7 w-7 text-cyan" />,
    source: <Leaf className="h-7 w-7 text-[#FFD166]" />,
    tip: <Lightbulb className="h-7 w-7 text-green" />,
    done: <CheckCircle className="h-7 w-7 text-green" />,
  };

  const currentIcon = partsRef.current[currentPart]?.icon || "wave";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          data-testid="voice-call-modal"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-app/80 backdrop-blur-2xl" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative z-10 w-full max-w-sm mx-auto"
          >
            <div className="glass border border-glass-border rounded-3xl p-8 shadow-2xl overflow-hidden relative">
              {/* Animated glow when speaking */}
              {speaking && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(0,255,178,0.08) 0%, transparent 70%)" }}
                />
              )}

              {/* Close */}
              <button
                onClick={() => { stopAll(); onClose(); }}
                className="absolute right-4 top-4 p-2 bg-widget rounded-full hover:bg-glass-hover-bg transition-colors"
              >
                <X className="h-4 w-4 text-secondary" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-2">
                  // CarbonMind Voice Brief
                </div>

                {/* Animated avatar */}
                <div className="relative mx-auto h-24 w-24 mb-4">
                  <motion.div
                    animate={speaking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="h-24 w-24 rounded-full bg-gradient-to-br from-green to-cyan flex items-center justify-center"
                    style={{ boxShadow: speaking ? "0 0 40px rgba(0,255,178,0.4)" : "0 0 20px rgba(0,255,178,0.15)" }}
                  >
                    <motion.div
                      key={currentPart}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      {icons[currentIcon]}
                    </motion.div>
                  </motion.div>

                  {/* Sound waves when speaking */}
                  {speaking && [1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 rounded-full border border-green/30 pointer-events-none"
                      animate={{ scale: [1, 1.6 + i * 0.2], opacity: [0.4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </div>

                <h2 className="text-xl font-display font-bold text-main">Daily Briefing</h2>
                <p className="text-sm text-secondary mt-1">
                  {done ? "Briefing complete!" : speaking ? "Speaking..." : "Paused"}
                </p>
              </div>

              {/* Progress bar */}
              {!done && (
                <div className="w-full h-1 bg-glass-bg rounded-full mb-6 overflow-hidden">
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-green to-cyan rounded-full"
                  />
                </div>
              )}

              {/* Caption box */}
              <motion.div
                key={caption}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-glass-bg border border-glass-border rounded-2xl p-4 mb-6 min-h-[80px] flex items-center justify-center text-center"
              >
                <p className="text-sm text-main leading-relaxed">
                  {caption || "Preparing your briefing..."}
                </p>
              </motion.div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-widget rounded-xl p-3 text-center border border-glass-border">
                  <div className="text-lg font-bold font-mono-data text-green">{todayKg}</div>
                  <div className="text-xs text-secondary mt-1">kg today</div>
                </div>
                <div className="bg-widget rounded-xl p-3 text-center border border-glass-border">
                  <div className="text-lg font-bold font-mono-data text-cyan">{budget}</div>
                  <div className="text-xs text-secondary mt-1">kg budget</div>
                </div>
                <div className={`rounded-xl p-3 text-center border ${overUnder === 'under' ? 'bg-green/10 border-green/30' : 'bg-red-400/10 border-red-400/30'}`}>
                  <div className={`text-lg font-bold font-mono-data ${overUnder === 'under' ? 'text-green' : 'text-red-400'}`}>{overUnder === 'under' ? '-' : '+'}{diff}</div>
                  <div className="text-xs text-secondary mt-1">vs budget</div>
                </div>
              </div>

              {/* Controls */}
              {!done ? (
                <div className="flex gap-3">
                  <button
                    onClick={toggle}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-glass-border bg-widget hover:bg-glass-hover-bg transition-colors text-main font-medium text-sm"
                  >
                    {speaking ? (
                      <><VolumeX className="h-4 w-4" /> Pause</>
                    ) : (
                      <><Volume2 className="h-4 w-4 text-green" /> Resume</>
                    )}
                  </button>
                  <button
                    onClick={() => { stopAll(); onClose(); }}
                    className="flex-1 py-3 rounded-xl bg-glass-bg border border-glass-border text-secondary hover:text-main hover:bg-glass-hover-bg transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { stopAll(); onClose(); }}
                  className="w-full py-3 rounded-xl bg-green text-app font-bold hover:bg-green/90 transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceCallModal;
