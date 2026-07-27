import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend } from "recharts";
import { Flame, Bike, Leaf, Sun, TrendingDown, TrendingUp, Send, Mic, Sparkles, ArrowUpRight, Volume2, PhoneCall } from "lucide-react";
import { getCarbonStats, sendChat } from "@/lib/api";
import { useUser } from "@/lib/UserContext";
import VoiceCallModal from "@/components/VoiceCallModal";

const iconMap = { flame: Flame, bike: Bike, leaf: Leaf, sun: Sun };

const Dashboard = () => {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callOpen, setCallOpen] = useState(false);

  useEffect(() => {
    getCarbonStats().then((d) => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <div className="font-mono-data text-[#9EABBC]">Loading carbon telemetry...</div>;
  }

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      {/* AI Call banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-5 glass-hover flex flex-wrap items-center justify-between gap-4"
        data-testid="ai-call-banner"
      >
        <div className="flex items-center gap-4">
          <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] flex items-center justify-center">
            <PhoneCall className="h-5 w-5 text-[#071014]" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF4D4D] border-2 border-[#071014] animate-pulse" />
          </div>
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// AI Voice Briefing available</div>
            <div className="font-display text-lg">CarbonMind wants to call you about this week.</div>
          </div>
        </div>
        <button
          onClick={() => setCallOpen(true)}
          className="btn-primary text-sm inline-flex items-center gap-2"
          data-testid="answer-call-btn"
        >
          <PhoneCall className="h-4 w-4" /> Receive AI call
        </button>
      </motion.div>

      {/* Top metrics row */}
      <div className="grid lg:grid-cols-3 gap-5">
        <CarbonScoreCard stats={stats} user={user} />
        <WeeklyTrendCard data={stats.weekly_trend} />
        <BreakdownCard data={stats.breakdown} />
      </div>

      {/* Middle row: prediction + chat */}
      <div className="grid lg:grid-cols-3 gap-5">
        <PredictionCard data={stats.prediction} />
        <ChatCard />
      </div>

      {/* Voice + Achievements + Recommendations */}
      <div className="grid lg:grid-cols-3 gap-5">
        <VoiceCard stats={stats} />
        <AchievementsCard items={stats.achievements} />
        <RecommendationsCard items={stats.recommendations} />
      </div>

      <VoiceCallModal
        open={callOpen}
        onClose={() => setCallOpen(false)}
        userName={user?.name || "there"}
        weeklyKg={stats.week_kg}
        topCategory={stats.breakdown[0]?.name || "Transport"}
      />
    </div>
  );
};

const CarbonScoreCard = ({ stats, user }) => {
  const score = stats.score;
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="glass p-7 glass-hover relative overflow-hidden glow-ring" data-testid="carbon-score-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Carbon Score</div>
          <div className="font-display text-xl mt-1">Today</div>
        </div>
        <span className="font-mono-data text-xs px-2 py-1 rounded-full bg-[#00FFB2]/10 text-[#00FFB2] border border-[#00FFB2]/20">
          Grade {stats.grade}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-[170px] w-[170px]">
          <svg className="rotate-[-90deg]" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.06)" strokeWidth="10" fill="none" />
            <motion.circle
              cx="80" cy="80" r="70"
              stroke="url(#scoreGradient)"
              strokeWidth="10" fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00FFB2" />
                <stop offset="100%" stopColor="#00D9FF" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono-data text-4xl font-bold neon-text-green">{score}</div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#9EABBC]">/ 100</div>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <Metric label="Today" value={`${stats.today_kg} kg`} delta={stats.trend_pct} positive />
          <Metric label="Week" value={`${stats.week_kg} kg`} delta={-3.4} positive />
          <Metric label="Month" value={`${stats.month_kg} kg`} delta={-12.1} positive />
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, delta }) => (
  <div className="flex items-center justify-between">
    <div>
      <div className="text-xs text-[#9EABBC]">{label}</div>
      <div className="font-mono-data text-base">{value}</div>
    </div>
    <div className={`flex items-center gap-1 text-xs font-mono-data ${delta < 0 ? "text-[#00FFB2]" : "text-[#FFD166]"}`}>
      {delta < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {delta}%
    </div>
  </div>
);

const WeeklyTrendCard = ({ data }) => (
  <div className="glass p-6 glass-hover" data-testid="weekly-trend-card">
    <div className="flex items-center justify-between mb-2">
      <div>
        <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Weekly Trend</div>
        <div className="font-display text-xl mt-1">Emissions per day</div>
      </div>
      <Sparkles className="h-4 w-4 text-[#00D9FF]" />
    </div>
    <div className="h-[200px] mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00FFB2" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#00FFB2" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="day" stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
          <Area type="monotone" dataKey="kg" stroke="#00FFB2" strokeWidth={2} fill="url(#areaGreen)" />
          <Line type="monotone" dataKey="target" stroke="#00D9FF" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const BreakdownCard = ({ data }) => (
  <div className="glass p-6 glass-hover" data-testid="breakdown-card">
    <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Sources</div>
    <div className="font-display text-xl mt-1">Emission breakdown</div>
    <div className="grid grid-cols-2 gap-3 mt-3 items-center">
      <div className="h-[170px] relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-[#9EABBC]">{d.name}</span>
            <span className="font-mono-data text-white">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PredictionCard = ({ data }) => (
  <div className="glass p-6 glass-hover lg:col-span-2" data-testid="prediction-card">
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// AI Prediction Panel</div>
        <div className="font-display text-xl mt-1">Future Carbon Risk</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#00FFB2]" style={{ boxShadow: "0 0 10px #00FFB2" }} />
        <span className="font-mono-data text-xs text-[#9EABBC]">Live model</span>
      </div>
    </div>
    <div className="h-[230px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#5C6B7A" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.2)", borderRadius: 12, color: "#fff" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9EABBC" }} />
          <Line type="monotone" dataKey="actual" stroke="#00FFB2" strokeWidth={2.5} dot={{ r: 3, fill: "#00FFB2" }} name="Actual" />
          <Line type="monotone" dataKey="predicted" stroke="#00D9FF" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 3, fill: "#00D9FF" }} name="Predicted" />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="grid grid-cols-3 gap-3 mt-4">
      <RiskMeter label="6-month risk" value={28} color="#00FFB2" />
      <RiskMeter label="12-month risk" value={42} color="#FFD166" />
      <RiskMeter label="Trajectory" value="↓ Improving" color="#00D9FF" isText />
    </div>
  </div>
);

const RiskMeter = ({ label, value, color, isText }) => (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
    <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#9EABBC]">{label}</div>
    <div className="font-mono-data text-lg mt-1" style={{ color }}>{isText ? value : `${value}%`}</div>
    {!isText && (
      <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1.2 }} className="h-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    )}
  </div>
);

const ChatCard = () => {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hey! I'm CarbonMind. Ask me anything about your carbon habits." }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionRef = useRef(`sess_${Date.now()}`);
  const listRef = useRef(null);

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    setSending(true);
    const q = input;
    setInput("");
    try {
      const res = await sendChat(sessionRef.current, q);
      setMessages((m) => [...m, { role: "ai", text: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Quick tip: 2 weekly cycling commutes can cut ~1.2 kg CO₂/day." }]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
    }
  };

  return (
    <div className="glass p-6 glass-hover flex flex-col" data-testid="chat-card" style={{ minHeight: 380 }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// AI Coach</div>
          <div className="font-display text-xl mt-1">Sustainability Chat</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00FFB2]" style={{ boxShadow: "0 0 10px #00FFB2" }} />
          <span className="font-mono-data text-xs text-[#9EABBC]">Gemini</span>
        </div>
      </div>
      <div ref={listRef} className="flex-1 mt-3 space-y-2 overflow-y-auto pr-1 max-h-[280px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed ${m.role === "user" ? "bg-[#00FFB2]/15 border border-[#00FFB2]/25 text-white" : "bg-white/[0.04] border border-white/[0.06] text-[#cfd8e0]"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="text-xs font-mono-data text-[#9EABBC] flex items-center gap-2 px-2"><span className="h-1.5 w-1.5 rounded-full bg-[#00FFB2] animate-pulse" /> Thinking...</div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="How can I reduce transport emissions?"
          className="input-glass text-sm"
        />
        <button data-testid="chat-send-btn" onClick={send} className="btn-primary !p-3 !px-4"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
};

const VoiceCard = ({ stats }) => {
  const [speaking, setSpeaking] = useState(false);

  const analyze = () => {
    const text = `Hey ${"there"}. Your weekly emissions dropped by ${Math.abs(stats.trend_pct)} percent. Transport remains your top source at ${stats.breakdown[0].value} percent. Consider replacing two short car trips with cycling this week.`;
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  return (
    <div className="glass p-6 glass-hover relative overflow-hidden" data-testid="voice-card">
      <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// AI Voice Assistant</div>
      <div className="font-display text-xl mt-1">Listen to your week</div>

      <div className="relative mt-5 flex items-center justify-center h-[120px]">
        <motion.div
          animate={speaking ? { scale: [1, 1.15, 1] } : { scale: 1 }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute h-24 w-24 rounded-full bg-[#00FFB2]/10 border border-[#00FFB2]/30"
          style={{ boxShadow: "0 0 40px rgba(0,255,178,0.25)" }}
        />
        <button
          data-testid="voice-analyze-btn"
          onClick={speaking ? stop : analyze}
          className="relative h-16 w-16 rounded-full bg-gradient-to-br from-[#00FFB2] to-[#00D9FF] flex items-center justify-center text-[#071014] font-bold transition hover:scale-105"
          style={{ boxShadow: "0 0 30px rgba(0,255,178,0.55)" }}
        >
          {speaking ? <Volume2 className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
      </div>
      {speaking && (
        <div className="flex items-end justify-center gap-1 h-6 mt-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="wave-bar w-[3px] bg-[#00FFB2]" style={{ height: `${10 + (i % 3) * 6}px`, animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      )}
      <button
        data-testid="voice-text-btn"
        onClick={speaking ? stop : analyze}
        className="mt-3 w-full text-sm btn-ghost"
      >
        {speaking ? "Stop briefing" : "Analyze My Carbon Habits"}
      </button>
    </div>
  );
};

const AchievementsCard = ({ items }) => (
  <div className="glass p-6 glass-hover" data-testid="achievements-card">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Eco XP</div>
        <div className="font-display text-xl mt-1">Achievements</div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-[#9EABBC]" />
    </div>
    <div className="grid grid-cols-2 gap-3 mt-4">
      {items.map((a) => {
        const Icon = iconMap[a.icon] || Leaf;
        return (
          <div key={a.id} className={`p-3 rounded-xl border ${a.earned ? "bg-[#00FFB2]/[0.04] border-[#00FFB2]/20" : "bg-white/[0.02] border-white/[0.05] opacity-60"}`}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${a.earned ? "bg-[#00FFB2]/15 text-[#00FFB2]" : "bg-white/5 text-[#9EABBC]"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="font-medium text-sm">{a.title}</div>
            <div className="text-[11px] text-[#9EABBC] mt-0.5">{a.desc}</div>
          </div>
        );
      })}
    </div>
  </div>
);

const RecommendationsCard = ({ items }) => (
  <div className="glass p-6 glass-hover" data-testid="recommendations-card">
    <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#00FFB2]">// Smart tips</div>
    <div className="font-display text-xl mt-1">Recommendations</div>
    <div className="mt-3 space-y-2">
      {items.map((r) => (
        <div key={r.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#00FFB2]/20 hover:bg-white/[0.04] transition group cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="text-sm">{r.title}</div>
            <ArrowUpRight className="h-4 w-4 text-[#5C6B7A] group-hover:text-[#00FFB2] transition" />
          </div>
          <div className="font-mono-data text-[11px] mt-1 text-[#00FFB2]">{r.impact}</div>
        </div>
      ))}
    </div>
  </div>
);

export default Dashboard;
