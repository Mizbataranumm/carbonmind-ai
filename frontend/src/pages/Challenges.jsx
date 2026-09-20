import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Plus, Check, Loader2 } from "lucide-react";
import { useUser } from "@/lib/UserContext";
import { getCommunityFeed, joinChallenge } from "@/lib/api";

const STATIC_CHALLENGES = [
  {
    id: "meatless",
    title: "Meatless March",
    desc: "Skip meat for 30 days",
    reward: "+500 XP",
    rewardType: "xp",
    joinedCount: "1,240",
    timeLeft: "12d",
    progress: 30,
  },
  {
    id: "cycle",
    title: "Cycle 100km",
    desc: "Log 100km cycling this month",
    reward: "Bike Knight badge",
    rewardType: "badge",
    joinedCount: "870",
    timeLeft: "7d",
    progress: 50,
  },
  {
    id: "noac",
    title: "No-AC Week",
    desc: "One week without air conditioning",
    reward: "+300 XP",
    rewardType: "xp",
    joinedCount: "421",
    timeLeft: "3d",
    progress: 75,
  },
];

export default function Challenges() {
  const { user } = useUser();
  const [challenges, setChallenges] = useState(STATIC_CHALLENGES);
  const [joined, setJoined] = useState({});
  const [joiningId, setJoiningId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load live challenges from the community feed
  useEffect(() => {
    setLoading(true);
    getCommunityFeed()
      .then((feed) => {
        const liveChallenges = (feed?.challenges || []).map((c) => ({
          id: c.id,
          title: c.title,
          desc: c.description || c.desc || "",
          reward: c.reward || "+XP",
          rewardType: c.reward_type || "xp",
          joinedCount: c.joined_count?.toLocaleString() || "0",
          timeLeft: c.days_left != null ? `${c.days_left}d` : "—",
          progress: Math.round((c.joined_count || 0) / Math.max(c.target_count || 1, 1) * 100),
        }));
        if (liveChallenges.length > 0) setChallenges(liveChallenges);
        // Prefill join state from server
        const joinedMap = {};
        (feed?.joined_challenge_ids || []).forEach((id) => { joinedMap[id] = true; });
        setJoined(joinedMap);
      })
      .catch(() => {
        // Backend unavailable — static placeholder list remains visible
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleJoin = useCallback(async (challengeId) => {
    if (!user?.id || joiningId) return;
    setJoiningId(challengeId);
    // Optimistic update
    setJoined((prev) => ({ ...prev, [challengeId]: !prev[challengeId] }));
    try {
      await joinChallenge({ challenge_id: challengeId, user_id: user.id });
    } catch {
      // Rollback on error
      setJoined((prev) => ({ ...prev, [challengeId]: !prev[challengeId] }));
    } finally {
      setJoiningId(null);
    }
  }, [user?.id, joiningId]);

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono-data text-[12px] uppercase tracking-widest text-green mb-1">// ACTIVE</div>
          <h1 className="text-3xl font-display font-bold text-main">Eco challenges</h1>
        </div>
        <Flame className="h-6 w-6 text-[#FFD166]" />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-secondary text-sm mb-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading challenges…
        </div>
      )}

      <div className="space-y-6">
        {challenges.map((c, i) => {
          const isJoined = Boolean(joined[c.id]);
          const isPending = joiningId === c.id;
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
                <span className="font-mono-data text-sm font-bold text-green">{c.reward}</span>
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
                id={`join-challenge-${c.id}`}
                onClick={() => toggleJoin(c.id)}
                disabled={isPending}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-medium ${
                  isJoined
                    ? "bg-green/10 border-green text-green"
                    : "bg-glass-bg border-glass-border text-main hover:bg-glass-hover-bg hover:border-white/20"
                } ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isJoined ? (
                  <><Check className="h-4 w-4" /> Joined</>
                ) : (
                  <><Plus className="h-4 w-4" /> Join challenge</>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
