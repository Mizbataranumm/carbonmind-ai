import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Leaf, RotateCcw, Volume2, VolumeX, X } from "lucide-react";

const tipFor = (topCategory) => {
  const tips = {
    Transport: "For a short upcoming trip, walking, cycling, or public transport can lower the transport part of your record.",
    Electricity: "Switch off unused devices and defer high-energy tasks when practical to reduce electricity use.",
    Food: "For a future meal, a lower-impact option can reduce the food part of your record.",
    Devices: "Unplug idle chargers and put devices to sleep when you are finished using them.",
  };
  return tips[topCategory] || "Add a completed activity or confirm a meal when it happens to keep your record useful.";
};

export default function VoiceCallModal({ open, onClose, userName = "Explorer", todayKg = 0, topCategory = "No recorded category" }) {
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("");
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);

  const parts = useMemo(() => {
    const recorded = Number(todayKg) > 0;
    if (!recorded) {
      return [
        `Hi ${userName}. This is your CarbonMind daily audio brief.`,
        "There are no saved activities for today yet, so there is no emissions total to report.",
        "Add a completed activity or confirm a scanned meal when it happens. Your brief will then use that saved record.",
      ];
    }

    const remaining = Math.abs(6.5 - Number(todayKg)).toFixed(1);
    const budgetMessage = Number(todayKg) > 6.5
      ? `That is ${remaining} kilograms above your 6.5 kilogram daily budget.`
      : `That is ${remaining} kilograms below your 6.5 kilogram daily budget.`;
    return [
      `Hi ${userName}. Here is your CarbonMind daily audio brief.`,
      `Your saved activity record totals ${Number(todayKg).toFixed(1)} kilograms of CO2 equivalent today. ${budgetMessage}`,
      `Your largest recorded category is ${topCategory}. ${tipFor(topCategory)}`,
    ];
  }, [todayKg, topCategory, userName]);

  const stop = () => {
    cancelled.current = true;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const play = () => {
    if (!("speechSynthesis" in window)) {
      setCaption("Audio playback is not available in this browser. You can still read the briefing below.");
      return;
    }

    stop();
    cancelled.current = false;
    setFinished(false);
    setSpeaking(true);
    let index = 0;

    const speakNext = () => {
      if (cancelled.current) return;
      if (index >= parts.length) {
        setSpeaking(false);
        setFinished(true);
        return;
      }
      const text = parts[index];
      index += 1;
      setCaption(text);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((voice) => voice.lang === "en-IN") || voices.find((voice) => voice.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
      utterance.onend = speakNext;
      utterance.onerror = speakNext;
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!open) {
      stop();
      setCaption("");
      setFinished(false);
    }
  }, [open]);

  const close = () => {
    stop();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-md rounded-2xl border border-glass-border bg-panel p-5 shadow-2xl sm:p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={close} className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-widget hover:text-main" aria-label="Close daily audio brief">
              <X className="h-4 w-4" />
            </button>

            <div className="pr-10">
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Saved-record audio</div>
              <h2 className="mt-1 font-display text-2xl text-main">Daily audio brief</h2>
              <p className="mt-2 text-sm leading-relaxed text-secondary">A short playback of today&apos;s saved activity record. It does not record your voice or answer questions.</p>
            </div>

            <div className="mt-6 flex flex-col items-center rounded-2xl border border-glass-border bg-widget p-5 text-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full border ${speaking ? "border-green bg-green/15 text-green" : "border-glass-border bg-panel text-secondary"}`}>
                <Leaf className={`h-7 w-7 ${speaking ? "animate-pulse" : ""}`} />
              </div>
              <p className="mt-4 font-mono-data text-2xl text-main">{Number(todayKg).toFixed(1)} <span className="text-sm text-secondary">kg CO2e saved today</span></p>
              <p className="mt-1 text-xs text-secondary">{topCategory === "No recorded category" ? "No category recorded" : `Largest category: ${topCategory}`}</p>
            </div>

            <div className="mt-4 min-h-24 rounded-xl border border-glass-border bg-widget p-4 text-sm leading-relaxed text-secondary">
              {caption || "Press play to hear the briefing. The text will appear here as it plays."}
            </div>

            {finished && <div className="mt-3 flex items-center gap-2 text-sm text-green"><CheckCircle2 className="h-4 w-4" /> Briefing complete</div>}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={speaking ? stop : play} className="btn-primary inline-flex items-center justify-center gap-2 !py-3">
                {speaking ? <><VolumeX className="h-4 w-4" /> Stop</> : <><Volume2 className="h-4 w-4" /> Play brief</>}
              </button>
              <button type="button" onClick={play} disabled={speaking} className="inline-flex items-center justify-center gap-2 rounded-xl border border-glass-border bg-widget py-3 text-sm font-semibold text-main transition hover:bg-glass-hover-bg disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="h-4 w-4" /> Replay
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
