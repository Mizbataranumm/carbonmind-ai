import React, { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Plus, Check } from "lucide-react";

export default function Challenges() {
  const [joined, setJoined] = useState({});

  const toggleJoin = (id) => {
    setJoined(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const challengesList = [
    {
      id: "meatless",
      title: "Meatless March",
      desc: "Skip meat for 30 days",
      reward: "+500 XP",
      rewardType: "xp",
      joinedCount: "1,240",
      timeLeft: "12d",
      progress: 30
    },
    {
      id: "cycle",
      title: "Cycle 100km",
      desc: "Log 100km cycling this month",
      reward: "Bike Knight badge",
      rewardType: "badge",
      joinedCount: "870",
      timeLeft: "7d",
      progress: 50
    },
    {
      id: "noac",
      title: "No-AC Week",
      desc: "One week without air conditioning",
      reward: "+300 XP",
      rewardType: "xp",
      joinedCount: "421",
      timeLeft: "3d",
      progress: 75
    }
  ];

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono-data text-[12px] uppercase tracking-widest text-green mb-1">// ACTIVE</div>
          <h1 className="text-3xl font-display font-bold text-main">Eco challenges</h1>
        </div>
        <Flame className="h-6 w-6 text-[#FFD166]" />
      </div>

      <div className="space-y-6">
        {challengesList.map((c, i) => {
          const isJoined = joined[c.id];
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-widget border border-glass-border p-6 rounded-2xl shadow-lg hover:border-green/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold text-main">{c.title}</h2>
                <span className={`font-mono-data text-sm font-bold ${c.rewardType === 'badge' ? 'text-green' : 'text-green'}`}>
                  {c.reward}
                </span>
              </div>
              
              <p className="text-secondary text-sm mb-6">{c.desc}</p>

              <div className="flex justify-between items-center text-sm font-mono-data text-secondary mb-3">
                <span>{c.joinedCount} joined</span>
                <span>{c.timeLeft} left</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-glass-bg rounded-full mb-6 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${c.progress}%` }}
                  transition={{ duration: 1, delay: 0.2 + (i * 0.1) }}
                  className="h-full bg-cyan shadow-[0_0_10px_rgba(0,217,255,0.5)] rounded-full"
                />
              </div>

              <button
                onClick={() => toggleJoin(c.id)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-medium ${
                  isJoined 
                    ? 'bg-green/10 border-green text-green'
                    : 'bg-glass-bg border-glass-border text-main hover:bg-glass-hover-bg hover:border-white/20'
                }`}
              >
                {isJoined ? (
                  <>
                    <Check className="h-4 w-4" />
                    Joined
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Join challenge
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
