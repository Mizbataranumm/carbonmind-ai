import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Mic, MicOff, Leaf, TrendingDown, Lightbulb, CheckCircle, Send, Sparkles, Phone, MessageSquare } from "lucide-react";
import { sendChat } from "@/lib/api";

const VoiceCallModal = ({ open, onClose, userName = "Explorer", weeklyKg = 41.8, topCategory = "Transport" }) => {
  const [tab, setTab] = useState("briefing"); // "briefing" | "talk"
  
  // Briefing state
  const [speaking, setSpeaking] = useState(false);
  const [done, setDone] = useState(false);
  const [caption, setCaption] = useState("");
  const [currentPart, setCurrentPart] = useState(0);
  const utterRef = useRef(null);
  const partsRef = useRef([]);
  const isCancelled = useRef(false);

  // Interactive Talk state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentReply, setAgentReply] = useState("Hello! I'm your AI Carbon Agent. Tap the mic to talk, or select a question below.");
  const recognitionRef = useRef(null);

  const todayKg = weeklyKg > 0 ? (weeklyKg / 7).toFixed(1) : "0.0";
  const budget = 6.5;
  const overUnder = parseFloat(todayKg) > budget ? "over" : "under";
  const diff = Math.abs(parseFloat(todayKg) - budget).toFixed(1);

  const tips = [
    "Try cycling or walking for short trips under 2 km.",
    "Switch off appliances fully instead of leaving them on standby.",
    "One plant-based meal today can save up to 2.5 kg of CO2.",
  ];

  const buildScript = () => [
    { text: `Hey ${userName}! Here is your CarbonMind daily voice briefing.`, icon: "wave" },
    { text: `Today you emitted approximately ${todayKg} kilograms of CO2. Your daily budget is ${budget} kilograms. You are ${diff} kg ${overUnder} budget.`, icon: "chart" },
    { text: `Your biggest emission source is ${topCategory}. This is where you can make the most impact.`, icon: "source" },
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
    setAgentSpeaking(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  const speakText = (text, onComplete) => {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.05;
    u.volume = 1.0;
    const voices = window.speechSynthesis?.getVoices() || [];
    const preferred = voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang.startsWith("en")) || null;
    if (preferred) u.voice = preferred;
    u.onend = () => {
      setAgentSpeaking(false);
      if (onComplete) onComplete();
    };
    u.onerror = () => {
      setAgentSpeaking(false);
      if (onComplete) onComplete();
    };
    setAgentSpeaking(true);
    window.speechSynthesis?.speak(u);
  };

  // Briefing runner
  useEffect(() => {
    if (!open) {
      stopAll();
      setDone(false);
      setCaption("");
      setCurrentPart(0);
      return;
    }

    if (tab === "briefing") {
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
        const voices = window.speechSynthesis?.getVoices() || [];
        const preferred = voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang.startsWith("en")) || null;
        if (preferred) u.voice = preferred;

        u.onend = () => setTimeout(playNext, 400);
        u.onerror = () => setTimeout(playNext, 300);
        utterRef.current = u;
        window.speechSynthesis?.speak(u);
      };

      setTimeout(playNext, 600);
    } else {
      stopAll();
      // Greet when opening talk tab
      speakText(`Hello ${userName}! How can I help you today? You can ask me about your emissions or how to reduce your carbon footprint.`);
    }

    return () => stopAll();
  }, [open, tab]);

  // Setup Web Speech API for Talk tab
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. You can click any question below to interact!");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      window.speechSynthesis?.cancel();
      setAgentSpeaking(false);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setTranscript("Listening to you...");
      };

      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setTranscript(text);
        handleUserQuery(text);
      };

      rec.onerror = (e) => {
        setIsListening(false);
        setTranscript("");
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    }
  };

  const handleUserQuery = async (queryText) => {
    if (!queryText) return;
    setTranscript(queryText);
    let reply = "";
    try {
      const res = await sendChat("voice-session", queryText);
      reply = res?.reply || res?.message || "I am here to help you reduce your carbon footprint!";
    } catch (e) {
      const q = queryText.toLowerCase();
      if (q.includes("hello") || q.includes("hi") || q.includes("hlo") || q.includes("hey")) {
        reply = `Hello ${userName}! How can I help you with your carbon footprint today?`;
      } else if (q.includes("where") && (q.includes("co2") || q.includes("emission") || q.includes("using"))) {
        reply = "Personal emissions mainly come from transport (driving and flights), home electricity, and food choices like meat and dairy. Check your dashboard for your exact breakdown!";
      } else if (q.includes("what is carbon footprint") || q.includes("carbon footprint")) {
        reply = "A carbon footprint is the total amount of greenhouse gases emitted into the atmosphere by our everyday actions, measured in kilograms of CO2.";
      } else if (q.includes("how to use") || q.includes("app")) {
        reply = "You can scan meals with the Food Scanner, predict daily emissions with the Daily Forecaster, or view your 10-year trajectory on the Simulator.";
      } else {
        reply = "Great question! Small daily swaps like walking short distances and eating more plant-based meals can cut your annual emissions significantly.";
      }
    }
    setAgentReply(reply);
    speakText(reply);
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
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-app/80 backdrop-blur-2xl" onClick={() => { stopAll(); onClose(); }} />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative z-10 w-full max-w-sm mx-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="glass border border-glass-border rounded-3xl p-6 shadow-2xl overflow-hidden relative" style={{ background: "var(--bg-secondary)" }}>
              {/* Close button */}
              <button
                onClick={() => { stopAll(); onClose(); }}
                className="absolute right-4 top-4 p-2 bg-widget rounded-full hover:bg-glass-hover-bg transition-colors z-20"
              >
                <X className="h-4 w-4 text-secondary" />
              </button>

              {/* Mode Tabs */}
              <div className="flex bg-widget p-1 rounded-2xl border border-glass-border mb-5">
                <button
                  onClick={() => setTab("briefing")}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === "briefing" ? "bg-green text-app shadow-md" : "text-secondary hover:text-main"
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" /> Audio Brief
                </button>
                <button
                  onClick={() => setTab("talk")}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === "talk" ? "bg-green text-app shadow-md" : "text-secondary hover:text-main"
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" /> Talk with Agent
                </button>
              </div>

              {/* TAB 1: DAILY BRIEFING */}
              {tab === "briefing" && (
                <div className="text-center">
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-green mb-2">
                    // Carbon Audio Brief
                  </div>

                  <div className="relative mx-auto h-20 w-20 mb-4">
                    <motion.div
                      animate={speaking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="h-20 w-20 rounded-full bg-gradient-to-br from-green to-cyan flex items-center justify-center mx-auto"
                      style={{ boxShadow: speaking ? "0 0 35px rgba(0,255,178,0.4)" : "0 0 15px rgba(0,255,178,0.15)" }}
                    >
                      {icons[currentIcon]}
                    </motion.div>
                  </div>

                  <h2 className="text-lg font-display font-bold text-main">Daily Briefing</h2>
                  <p className="text-xs text-secondary mt-0.5 mb-3">
                    {done ? "Briefing complete!" : speaking ? "Speaking aloud..." : "Paused"}
                  </p>

                  {!done && (
                    <div className="w-full h-1 bg-glass-bg rounded-full mb-4 overflow-hidden">
                      <motion.div
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-gradient-to-r from-green to-cyan rounded-full"
                      />
                    </div>
                  )}

                  <div className="bg-glass-bg border border-glass-border rounded-2xl p-3.5 mb-4 min-h-[75px] flex items-center justify-center text-center">
                    <p className="text-xs text-main leading-relaxed">
                      {caption || "Preparing your briefing..."}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-widget rounded-xl p-2 text-center border border-glass-border">
                      <div className="text-base font-bold font-mono-data text-green">{todayKg}</div>
                      <div className="text-[10px] text-secondary">kg today</div>
                    </div>
                    <div className="bg-widget rounded-xl p-2 text-center border border-glass-border">
                      <div className="text-base font-bold font-mono-data text-cyan">{budget}</div>
                      <div className="text-[10px] text-secondary">kg budget</div>
                    </div>
                    <div className={`rounded-xl p-2 text-center border ${overUnder === 'under' ? 'bg-green/10 border-green/30' : 'bg-red-400/10 border-red-400/30'}`}>
                      <div className={`text-base font-bold font-mono-data ${overUnder === 'under' ? 'text-green' : 'text-red-400'}`}>
                        {overUnder === 'under' ? '-' : '+'}{diff}
                      </div>
                      <div className="text-[10px] text-secondary">vs budget</div>
                    </div>
                  </div>

                  <button
                    onClick={() => { stopAll(); onClose(); }}
                    className="w-full py-2.5 rounded-xl bg-green text-app font-bold hover:bg-green/90 transition-colors text-sm"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* TAB 2: INTERACTIVE VOICE AGENT */}
              {tab === "talk" && (
                <div className="text-center">
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-cyan mb-2">
                    // Live AI Voice Assistant
                  </div>

                  {/* Mic orb button */}
                  <div className="relative mx-auto h-24 w-24 mb-4 flex items-center justify-center">
                    <button
                      onClick={toggleListening}
                      className={`h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
                        isListening
                          ? "bg-red-500 text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.6)]"
                          : agentSpeaking
                            ? "bg-green text-app shadow-[0_0_30px_rgba(0,255,178,0.5)]"
                            : "bg-gradient-to-br from-green to-cyan text-app hover:scale-105"
                      }`}
                      title={isListening ? "Listening... tap to stop" : "Tap to speak"}
                    >
                      {isListening ? (
                        <Mic className="h-8 w-8 animate-bounce" />
                      ) : (
                        <Mic className="h-8 w-8" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs font-bold text-main">
                    {isListening ? "🔴 Listening to you... Speak now" : agentSpeaking ? "🔊 AI Speaking..." : "Tap the Mic or a question below"}
                  </p>

                  {/* Transcript / Reply Display */}
                  <div className="bg-glass-bg border border-glass-border rounded-2xl p-3.5 my-3 min-h-[90px] flex flex-col justify-center text-left">
                    {transcript && (
                      <p className="text-[11px] text-secondary mb-1">
                        <strong>You:</strong> {transcript}
                      </p>
                    )}
                    <p className="text-xs text-main leading-relaxed">
                      <strong className="text-green">Coach:</strong> {agentReply}
                    </p>
                  </div>

                  {/* Quick question pills */}
                  <div className="space-y-1.5 mb-4 text-left">
                    <p className="text-[10px] font-mono-data text-secondary uppercase tracking-wider">Quick Prompts:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => handleUserQuery("Hello")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-widget border border-glass-border text-secondary hover:text-green hover:border-green/40 transition"
                      >
                        👋 Hello
                      </button>
                      <button
                        onClick={() => handleUserQuery("Where am I using more CO2?")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-widget border border-glass-border text-secondary hover:text-green hover:border-green/40 transition"
                      >
                        📊 Where am I using more CO2?
                      </button>
                      <button
                        onClick={() => handleUserQuery("What is carbon footprint?")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-widget border border-glass-border text-secondary hover:text-green hover:border-green/40 transition"
                      >
                        🌱 What is carbon footprint?
                      </button>
                      <button
                        onClick={() => handleUserQuery("How to use this app?")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-widget border border-glass-border text-secondary hover:text-green hover:border-green/40 transition"
                      >
                        📱 How to use app?
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => { stopAll(); onClose(); }}
                    className="w-full py-2.5 rounded-xl border border-glass-border bg-widget hover:bg-glass-hover-bg text-secondary hover:text-main text-xs font-bold transition-all"
                  >
                    Close Voice Agent
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceCallModal;
