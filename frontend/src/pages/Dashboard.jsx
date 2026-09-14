import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useUser } from '@/lib/UserContext';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Leaf, TrendingDown, TrendingUp, Activity, Sparkles, Plus, Camera,
  Phone, Zap, Car, Utensils, Flame, Award, Target, BarChart2
} from 'lucide-react';
import VoiceCallModal from '@/components/VoiceCallModal';
import LogActivityModal from '@/components/LogActivityModal';
import PhoneCallModal from '@/components/PhoneCallModal';
import { getCarbonStats } from '@/lib/api';

function StatCard({ label, value, unit, icon: Icon, color, sub, trend }) {
  return (
    <div className="bg-widget border border-glass-border rounded-2xl p-4 flex flex-col gap-2 hover:border-opacity-50 transition-all shadow-sm"
         style={{ borderColor: color + '33' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary font-mono-data uppercase tracking-widest">{label}</span>
        <div className="p-2 rounded-xl" style={{ background: color + '20' }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      <div className="flex items-end gap-1.5 mt-2">
        <span className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
        <span className="text-sm text-secondary mb-0.5">{unit}</span>
      </div>
      {sub && (
        <div className="flex items-center gap-1.5 text-sm mt-1">
          {trend === 'down' ? <TrendingDown className="h-4 w-4 text-green" /> : <TrendingUp className="h-4 w-4 text-red-400" />}
          <span className={trend === 'down' ? 'text-green font-medium' : 'text-red-400 font-medium'}>{sub}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [stats, setStats] = useState(null);

  const refreshStats = useCallback(() => {
    if (!user?.id) return;
    getCarbonStats(user.id).then(setStats).catch(() => setStats(null));
  }, [user?.id]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const isNew = !stats?.activity_days;
  const streak = stats?.streak ?? 0;
  const budget = 6.5;
  const todayKg = stats?.today_kg ?? 0;
  const weeklyTotal = stats?.week_kg ?? 0;
  const monthTotal = stats?.month_kg ?? 0;
  const grade = stats?.grade || "Newbie";
  const weeklyData = stats?.weekly_trend || [];
  const emissionData = stats?.breakdown || [];
  const recentActivities = stats?.recent_activities || [];
  const pct = budget > 0 ? Math.round((todayKg / budget) * 100) : 0;
  const topCategory = useMemo(() => (
    emissionData.reduce((leader, item) => (item.kg > leader.kg ? item : leader), { name: 'No recorded category', kg: 0 }).name
  ), [emissionData]);

  return (
    <div className="w-full pb-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <VoiceCallModal open={voiceOpen} onClose={() => setVoiceOpen(false)} userName={user?.name || 'Explorer'} todayKg={todayKg} topCategory={topCategory} />
      <LogActivityModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={refreshStats} />
      <PhoneCallModal open={phoneOpen} onClose={() => setPhoneOpen(false)} userName={user?.name || 'Explorer'} todayKg={todayKg} topCategory={topCategory} />

      {/* ── HERO HEADER ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Welcome back, <span className="text-green">{user?.name || 'Explorer'}</span> 👋
          </h1>
          <p className="text-secondary mt-2 text-base">Your carbon dashboard — {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-glass-border bg-widget text-sm">
            <Flame className="h-5 w-5 text-[#FFD166]" />
            <span className="font-bold font-mono-data">{streak} Day Streak</span>
          </div>
          <button onClick={() => setVoiceOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan/30 bg-cyan/10 text-cyan font-bold text-sm hover:bg-cyan/20 transition-all shadow-[0_0_15px_rgba(0,217,255,0.1)]">
            <Mic className="h-5 w-5" /> Daily audio brief
          </button>
          <button onClick={() => setPhoneOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green/30 bg-green/10 text-green font-bold text-sm hover:bg-green/20 transition-all shadow-[0_0_15px_rgba(0,255,178,0.1)]">
            <Phone className="h-5 w-5" /> Phone briefing
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ROW ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's CO₂" value={todayKg} unit="kg" icon={BarChart2} color="#00FFB2" sub={isNew ? "No activity recorded" : "From saved activities"} trend="down" />
        <StatCard label="Weekly Total" value={weeklyTotal} unit="kg" icon={TrendingDown} color="#00D9FF" sub={isNew ? "Record your first day" : "Last 7 calendar days"} trend="down" />
        <StatCard label="Monthly Total" value={monthTotal} unit="kg" icon={Leaf} color="#A78BFA" sub="Current calendar month" trend="down" />
        <StatCard label="Carbon Grade" value={grade} unit="" icon={Award} color="#FFD166" sub="Based on today’s record" trend="down" />
      </div>

      {/* ── QUICK ACTIONS ROW (Full width below) ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate('/scan')}
          className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-green text-app font-bold hover:bg-green/90 transition-all hover:-translate-y-1 shadow-[0_0_20px_rgba(0,255,178,0.2)]">
          <Camera className="h-6 w-6 group-hover:scale-110 transition-transform" /> <span className="text-sm">Scan Food</span>
        </button>
        <button onClick={() => setLogOpen(true)}
          className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-glass-border bg-widget font-bold hover:bg-glass-hover-bg transition-all hover:-translate-y-1 hover:border-green/40 shadow-sm"
          style={{ color: 'var(--text-primary)' }}>
          <Plus className="h-6 w-6 text-green group-hover:scale-110 transition-transform" /> <span className="text-sm">Add activity</span>
        </button>
        <button onClick={() => navigate('/tracker')}
          className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-glass-border bg-widget font-bold hover:bg-glass-hover-bg transition-all hover:-translate-y-1 hover:border-cyan/40 shadow-sm"
          style={{ color: 'var(--text-primary)' }}>
          <Activity className="h-6 w-6 text-cyan group-hover:scale-110 transition-transform" /> <span className="text-sm">Activity history</span>
        </button>
        <button onClick={() => navigate('/predict')}
          className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-glass-border bg-widget font-bold hover:bg-glass-hover-bg transition-all hover:-translate-y-1 hover:border-purple-400/40 shadow-sm"
          style={{ color: 'var(--text-primary)' }}>
          <Target className="h-6 w-6 text-[#A78BFA] group-hover:scale-110 transition-transform" /> <span className="text-sm">Plan today</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: Main Charts (8 columns wide) */}
        <div className="lg:col-span-8 space-y-6 flex flex-col">
          
          {/* BUDGET BAR (Full width of the left column) */}
          <div className="bg-widget border border-glass-border rounded-3xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="font-mono-data text-[11px] uppercase tracking-widest text-green">// Daily Budget</span>
                <p className="font-bold text-xl mt-1" style={{ color: 'var(--text-primary)' }}>
                  {todayKg} kg used of {budget} kg budget
                </p>
              </div>
              <div className={`font-bold text-sm px-4 py-1.5 rounded-full ${pct > 100 ? 'bg-red-400/10 text-red-400 border border-red-400/30' : 'bg-green/10 text-green border border-green/30'}`}>
                {pct}% used
              </div>
            </div>
            <div className="w-full h-4 rounded-full overflow-hidden mb-3" style={{ background: 'var(--glass-bg)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  background: pct > 100 ? 'linear-gradient(90deg,#FF4D4D,#FF8C00)' : 'linear-gradient(90deg,#00FFB2,#00D9FF)',
                  boxShadow: pct > 100 ? '0 0 15px rgba(255,77,77,0.4)' : '0 0 15px rgba(0,255,178,0.4)',
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-secondary font-medium">
              <span>0 kg</span>
              <span className="text-green font-bold flex flex-col items-center"><span className="text-xl">▲</span>{budget} kg target</span>
              <span>{(budget * 1.5).toFixed(1)} kg</span>
            </div>
          </div>

          {/* WEEKLY TREND CHART */}
          <div className="bg-widget border border-glass-border rounded-3xl p-7 flex-1 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono-data text-[11px] uppercase tracking-widest text-green">// This Week</span>
                <p className="font-bold text-xl mt-1" style={{ color: 'var(--text-primary)' }}>Weekly Emission Trend</p>
              </div>
              <span className="text-sm font-medium text-secondary bg-glass-bg px-3 py-1 rounded-lg border border-glass-border">Daily kg CO₂</span>
            </div>
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--neon-green)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--neon-green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-accent)', border: '1px solid var(--glass-border)', borderRadius: 12, color: 'var(--text-primary)', padding: '12px' }} 
                    itemStyle={{ color: 'var(--neon-green)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="kg" stroke="var(--neon-green)" strokeWidth={3} fill="url(#gradFull)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 columns wide) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          
          {/* EMISSION SOURCES PIE */}
          <div className="bg-widget border border-glass-border rounded-3xl p-5 shadow-sm">
            <span className="font-mono-data text-[11px] uppercase tracking-widest text-green">// Emission Sources</span>
            <p className="font-bold text-xl mt-1 mb-4" style={{ color: 'var(--text-primary)' }}>Today's Breakdown</p>
            <div className="flex flex-col items-center">
              <div className="w-40 h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={emissionData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="none" paddingAngle={3}>
                      {emissionData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-3.5">
                {emissionData.map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: e.color }} />
                      <span className="text-sm text-secondary font-medium">{e.name}</span>
                    </div>
                    <div className="text-right flex-1 ml-4">
                      <span className="text-sm font-bold font-mono-data" style={{ color: 'var(--text-primary)' }}>{e.value}%</span>
                      <div className="w-full h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
                        <div className="h-full rounded-full" style={{ width: `${e.value}%`, background: e.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="bg-widget border border-glass-border rounded-3xl p-5 shadow-sm flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-cyan" />
              <span className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Recent Activity</span>
            </div>
            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-glass-border text-center py-6">
                  <Leaf className="h-8 w-8 text-green mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No activities logged yet today</p>
                  <p className="text-xs text-secondary mt-1 max-w-[220px] mx-auto">Scan a confirmed meal or add a completed activity to start your record.</p>
                  <button onClick={() => navigate('/scan')} className="mt-3 px-3 py-1.5 rounded-lg bg-green/10 border border-green/30 text-green text-xs font-bold hover:bg-green/20 transition-all">
                    + Scan First Meal
                  </button>
                </div>
              ) : (
                recentActivities.map((a) => {
                  const iconByType = { transport: Car, electricity: Zap, food: Utensils, devices: Activity, other: Activity };
                  const colorByType = { transport: '#00FFB2', electricity: '#00D9FF', food: '#FFD166', devices: '#FF66E1', other: '#9EABBC' };
                  const Icon = iconByType[a.type] || Activity;
                  const color = colorByType[a.type] || '#9EABBC';
                  return (
                    <div key={a.id} className="flex items-center gap-4 p-3 rounded-xl border border-glass-border hover:border-green/30 hover:bg-glass-hover-bg transition-all cursor-pointer">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                           style={{ background: color + '15' }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{a.label}</p>
                        <p className="text-[11px] font-medium text-secondary">{a.time ? new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recorded'} · {a.type}</p>
                      </div>
                      <span className="font-mono-data text-sm font-bold" style={{ color }}>+{a.kg} kg</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      </div>
      


    </div>
  );
}
