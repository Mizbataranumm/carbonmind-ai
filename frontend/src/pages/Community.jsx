import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Trophy, Users as UsersIcon, Flame, Sparkles } from "lucide-react";
import { getCommunityFeed } from "@/lib/api";

const Community = () => {
  const [feed, setFeed] = useState(null);

  useEffect(() => { getCommunityFeed().then(setFeed); }, []);

  if (!feed) return <div className="font-mono-data text-[#9EABBC]">Loading community...</div>;

  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="community-root">
      {/* Feed */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass p-6 glass-hover flex items-center justify-between">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Eco social</div>
            <div className="font-display text-2xl mt-1">Sustainability feed</div>
            <p className="text-sm text-[#9EABBC] mt-1">Real wins from your eco-collective.</p>
          </div>
          <UsersIcon className="h-5 w-5 text-[#00D9FF]" />
        </div>

        {feed.posts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass p-5 glass-hover"
            data-testid={`post-${p.id}`}
          >
            <div className="flex items-start gap-4">
              <img src={p.avatar} alt={p.user} className="h-11 w-11 rounded-full bg-[#0d1f27] border border-white/10" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.user}</div>
                    <div className="font-mono-data text-[10px] text-[#9EABBC] mt-0.5">{p.time} ago · #{p.tag}</div>
                  </div>
                  <span className="font-mono-data text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#00FFB2]/10 text-[#00FFB2] border border-[#00FFB2]/20">{p.tag}</span>
                </div>
                <p className="mt-3 text-sm text-[#cfd8e0] leading-relaxed">{p.text}</p>
                <div className="flex items-center gap-5 mt-4 text-xs text-[#9EABBC]">
                  <button className="flex items-center gap-1.5 hover:text-[#00FFB2] transition" data-testid={`like-${p.id}`}>
                    <Heart className="h-3.5 w-3.5" /> {p.likes}
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-white transition" data-testid={`comment-${p.id}`}>
                    <MessageCircle className="h-3.5 w-3.5" /> Reply
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Right: Challenges + Leaderboard */}
      <div className="space-y-5">
        <div className="glass p-6 glass-hover" data-testid="challenges-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Active</div>
              <div className="font-display text-xl mt-1">Eco challenges</div>
            </div>
            <Flame className="h-4 w-4 text-[#FFD166]" />
          </div>
          <div className="space-y-3">
            {feed.challenges.map((c) => (
              <div key={c.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#00FFB2]/25 transition cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{c.title}</div>
                  <span className="font-mono-data text-[10px] text-[#00FFB2]">{c.reward}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-[#9EABBC] font-mono-data">
                  <span>{c.members.toLocaleString()} joined</span>
                  <span>{c.days_left}d left</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(20, 100 - c.days_left * 6)}%` }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-[#00FFB2] to-[#00D9FF]" />
                </div>
              </div>
            ))}
          </div>
          <button className="btn-ghost w-full mt-4 text-sm" data-testid="join-challenge-btn">
            <Sparkles className="h-4 w-4 inline-block mr-2 text-[#00FFB2]" /> Browse all challenges
          </button>
        </div>

        <div className="glass p-6 glass-hover" data-testid="leaderboard-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Top eco-citizens</div>
              <div className="font-display text-xl mt-1">Leaderboard</div>
            </div>
            <Trophy className="h-4 w-4 text-[#FFD166]" />
          </div>
          <div className="space-y-2">
            {feed.leaderboard.map((l) => (
              <div key={l.rank} className={`flex items-center justify-between p-3 rounded-xl border ${l.user === "You" ? "bg-[#00FFB2]/8 border-[#00FFB2]/30" : "bg-white/[0.02] border-white/[0.05]"}`}>
                <div className="flex items-center gap-3">
                  <div className="font-mono-data text-sm text-[#9EABBC] w-5">#{l.rank}</div>
                  <div className="font-medium text-sm">{l.user}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-data text-xs text-[#00FFB2]">{l.xp.toLocaleString()} XP</span>
                  <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">{l.grade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Community;
