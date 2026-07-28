import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Trophy, Users as UsersIcon, Flame, Sparkles, Send, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { getCommunityFeed, likePost, commentPost, joinChallenge, createPost } from "@/lib/api";
import { useUser } from "@/lib/UserContext";

const Community = () => {
  const { user } = useUser();
  const [feed, setFeed] = useState(null);
  const [openComments, setOpenComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [newPostText, setNewPostText] = useState("");
  const [newPostTag, setNewPostTag] = useState("Milestone");
  const [posting, setPosting] = useState(false);
  const [showAllChallenges, setShowAllChallenges] = useState(false);

  const load = async () => {
    const d = await getCommunityFeed(user?.id);
    setFeed(d);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  if (!feed) return <div className="font-mono-data text-[#9EABBC]">Loading community...</div>;

  const toggleLike = async (postId) => {
    // Optimistic update
    setFeed(f => ({
      ...f,
      posts: f.posts.map(p => p.id === postId ? { ...p, liked_by_me: !p.liked_by_me, likes: p.likes + (p.liked_by_me ? -1 : 1) } : p)
    }));
    try {
      const r = await likePost({ user_id: user.id, post_id: postId });
      setFeed(f => ({
        ...f,
        posts: f.posts.map(p => p.id === postId ? { ...p, likes: r.likes, liked_by_me: r.liked } : p)
      }));
    } catch { toast.error("Could not save like"); }
  };

  const toggleComments = (postId) => {
    setOpenComments(o => ({ ...o, [postId]: !o[postId] }));
  };

  const submitComment = async (postId) => {
    const text = (commentInputs[postId] || "").trim();
    if (!text) return;
    try {
      const r = await commentPost({ user_id: user.id, user_name: user.name, post_id: postId, text });
      setFeed(f => ({
        ...f,
        posts: f.posts.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), r.comment] } : p)
      }));
      setCommentInputs(i => ({ ...i, [postId]: "" }));
      toast.success("Reply posted");
    } catch { toast.error("Reply failed"); }
  };

  const toggleJoin = async (challengeId) => {
    // Optimistic
    setFeed(f => ({
      ...f,
      challenges: f.challenges.map(c => c.id === challengeId ? { ...c, joined_by_me: !c.joined_by_me, members: c.members + (c.joined_by_me ? -1 : 1) } : c)
    }));
    try {
      const r = await joinChallenge({ user_id: user.id, challenge_id: challengeId });
      setFeed(f => ({
        ...f,
        challenges: f.challenges.map(c => c.id === challengeId ? { ...c, joined_by_me: r.joined, members: r.members } : c)
      }));
      toast.success(r.joined ? "Joined challenge · +XP incoming" : "Left challenge");
    } catch { toast.error("Could not update join status"); }
  };

  const submitPost = async () => {
    if (!newPostText.trim()) return;
    setPosting(true);
    try {
      await createPost({ user_id: user.id, user_name: user.name, avatar: user.avatar, text: newPostText, tag: newPostTag });
      setNewPostText("");
      await load();
      toast.success("Post shared with the community 🌿");
    } catch { toast.error("Could not publish"); }
    finally { setPosting(false); }
  };

  const visibleChallenges = showAllChallenges ? feed.challenges : feed.challenges.slice(0, 3);

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

        {/* Post composer */}
        <div className="glass p-5 glass-hover" data-testid="post-composer">
          <div className="flex items-start gap-3">
            <img src={user?.avatar} alt={user?.name} className="h-10 w-10 rounded-full bg-[#0d1f27] border border-white/10" />
            <div className="flex-1">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="Share your latest eco win..."
                className="input-glass !py-2 text-sm w-full resize-none min-h-[70px]"
                data-testid="post-composer-input"
              />
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap gap-1.5">
                  {["Transport", "Electricity", "Food", "Milestone", "Devices"].map(t => (
                    <button
                      key={t}
                      onClick={() => setNewPostTag(t)}
                      className={`text-[11px] px-2 py-1 rounded-full border transition ${newPostTag === t ? "bg-[#00FFB2]/10 border-[#00FFB2]/40 text-[#00FFB2]" : "bg-white/[0.02] border-white/[0.06] text-[#9EABBC] hover:text-white"}`}
                      data-testid={`post-tag-${t}`}
                    >#{t}</button>
                  ))}
                </div>
                <button
                  onClick={submitPost}
                  disabled={!newPostText.trim() || posting}
                  className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  data-testid="post-submit-btn"
                >
                  <Send className="h-3.5 w-3.5" /> {posting ? "Sharing..." : "Share"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {feed.posts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            className="glass p-5 glass-hover"
            data-testid={`post-${p.id}`}
          >
            <div className="flex items-start gap-4">
              <img src={p.avatar} alt={p.user} className="h-11 w-11 rounded-full bg-[#0d1f27] border border-white/10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.user}</div>
                    <div className="font-mono-data text-[10px] text-[#9EABBC] mt-0.5">{p.time} ago · #{p.tag}</div>
                  </div>
                  <span className="font-mono-data text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#00FFB2]/10 text-[#00FFB2] border border-[#00FFB2]/20">{p.tag}</span>
                </div>
                <p className="mt-3 text-sm text-[#cfd8e0] leading-relaxed">{p.text}</p>
                <div className="flex items-center gap-5 mt-4 text-xs">
                  <button
                    onClick={() => toggleLike(p.id)}
                    className={`flex items-center gap-1.5 transition ${p.liked_by_me ? "text-[#00FFB2]" : "text-[#9EABBC] hover:text-[#00FFB2]"}`}
                    data-testid={`like-${p.id}`}
                  >
                    <Heart className={`h-3.5 w-3.5 transition ${p.liked_by_me ? "fill-[#00FFB2]" : ""}`} /> {p.likes}
                  </button>
                  <button
                    onClick={() => toggleComments(p.id)}
                    className="flex items-center gap-1.5 text-[#9EABBC] hover:text-white transition"
                    data-testid={`comment-${p.id}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> {(p.comments || []).length > 0 ? `${p.comments.length} ${p.comments.length === 1 ? "reply" : "replies"}` : "Reply"}
                  </button>
                </div>

                <AnimatePresence>
                  {openComments[p.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-2 border-l border-white/[0.06] pl-3">
                        {(p.comments || []).map((c) => (
                          <div key={c.id} className="text-xs bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                            <span className="font-medium text-[#cfd8e0]">{c.user}</span>
                            <span className="text-[#9EABBC] ml-2">{c.text}</span>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input
                            value={commentInputs[p.id] || ""}
                            onChange={(e) => setCommentInputs(i => ({ ...i, [p.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && submitComment(p.id)}
                            placeholder="Reply..."
                            className="input-glass !py-1.5 !px-3 text-xs flex-1"
                            data-testid={`comment-input-${p.id}`}
                          />
                          <button
                            onClick={() => submitComment(p.id)}
                            className="btn-primary !py-1.5 !px-3"
                            data-testid={`comment-send-${p.id}`}
                          >
                            <Send className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
            {visibleChallenges.map((c) => (
              <div key={c.id} className={`p-3.5 rounded-xl border transition ${c.joined_by_me ? "bg-[#00FFB2]/8 border-[#00FFB2]/30" : "bg-white/[0.02] border-white/[0.05]"}`} data-testid={`challenge-${c.id}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{c.title}</div>
                  <span className="font-mono-data text-[10px] text-[#00FFB2]">{c.reward}</span>
                </div>
                {c.description && <div className="text-[11px] text-[#9EABBC] mt-1">{c.description}</div>}
                <div className="flex items-center justify-between mt-2 text-[11px] text-[#9EABBC] font-mono-data">
                  <span>{c.members.toLocaleString()} joined</span>
                  <span>{c.days_left}d left</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(20, 100 - c.days_left * 6)}%` }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-[#00FFB2] to-[#00D9FF]" />
                </div>
                <button
                  onClick={() => toggleJoin(c.id)}
                  className={`mt-3 w-full text-xs py-2 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${c.joined_by_me ? "bg-[#00FFB2]/15 text-[#00FFB2] border border-[#00FFB2]/30" : "bg-white/[0.03] text-white border border-white/[0.08] hover:border-[#00FFB2]/30"}`}
                  data-testid={`join-${c.id}`}
                >
                  {c.joined_by_me ? (<><Check className="h-3 w-3" /> Joined</>) : (<><Plus className="h-3 w-3" /> Join challenge</>)}
                </button>
              </div>
            ))}
          </div>
          {feed.challenges.length > 3 && (
            <button
              onClick={() => setShowAllChallenges(v => !v)}
              className="btn-ghost w-full mt-4 text-sm"
              data-testid="browse-challenges-btn"
            >
              <Sparkles className="h-4 w-4 inline-block mr-2 text-[#00FFB2]" />
              {showAllChallenges ? "Show fewer" : `Browse all ${feed.challenges.length} challenges`}
            </button>
          )}
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
