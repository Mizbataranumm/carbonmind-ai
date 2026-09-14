import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/lib/UserContext';
import { Leaf, ScanLine, Activity, Sparkles, TrendingUp, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function Onboarding() {
  const { user, setUser } = useUser();
    const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    transport: 'public',
    diet: 'mixed'
  });

  useEffect(() => {
    // Check onboarding status
    if (user?.onboarding_completed) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleComplete = async () => {
    try {
      const { data } = await api.post('/onboarding/save', { user_id: user.id, preferences });
      if (data.status === 'success') {
        setUser({ ...user, onboarding_completed: true, onboarding_preferences: preferences, user_transport: preferences.transport, user_diet: preferences.diet });
        toast.success('Welcome aboard!');
        navigate('/dashboard');
      }
    } catch (e) {
      toast.error('Failed to save preferences');
    }
  };

  const variants = {
    enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction < 0 ? 50 : -50, opacity: 0 })
  };

  return (
    <div className="min-h-screen bg-app text-main flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-green/10 to-transparent opacity-50 pointer-events-none" />
      
      <div className="w-full max-w-2xl z-10 relative">
        <div className="mb-8 flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green to-cyan flex items-center justify-center shadow-[0_0_40px_rgba(0,255,178,0.3)]">
            <Leaf className="h-8 w-8 text-[#071014]" strokeWidth={2.5} />
          </div>
        </div>

        <div className="glass p-5 sm:p-8 md:p-12 rounded-3xl border border-glass-border shadow-2xl relative overflow-hidden min-h-[450px] flex flex-col">
          <AnimatePresence mode="wait" custom={step}>
            {step === 1 && (
              <motion.div key="step1" custom={1} variants={variants} initial="enter" animate="center" exit="exit" className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="font-mono-data text-xs uppercase tracking-widest text-green mb-4">// Welcome</div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4">Build your activity record</h1>
                <p className="text-secondary text-lg mb-10 max-w-md mx-auto">Record the choices you make, review meal estimates, and compare explicit lifestyle assumptions.</p>

                <button onClick={() => setStep(2)} className="bg-green text-app px-8 py-4 rounded-xl font-bold hover:bg-green/90 transition-colors flex items-center gap-2 w-full md:w-auto justify-center">
                  Start Tracking <ChevronRight className="h-5 w-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" custom={1} variants={variants} initial="enter" animate="center" exit="exit" className="flex-1">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-display font-bold mb-2">Core tools</h2>
                  <p className="text-secondary">A clear place to record, review, and compare.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { icon: ScanLine, title: "Food Scanner", desc: "Review a meal candidate" },
                    { icon: Activity, title: "Activity Tracker", desc: "Save daily activities" },
                    { icon: Sparkles, title: "Future Planner", desc: "Compare assumptions" },
                    { icon: TrendingUp, title: "Daily Projection", desc: "Scale recorded hours" }
                  ].map((feat, i) => (
                    <div key={i} className="bg-widget p-3 rounded-xl border border-glass-border flex items-start gap-3">
                      <div className="bg-app p-2 rounded-lg text-green"><feat.icon className="h-4 w-4" /></div>
                      <div>
                        <div className="font-medium text-sm">{feat.title}</div>
                        <div className="text-[10px] text-secondary">{feat.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep(1)} className="px-6 py-3 text-secondary hover:text-main flex items-center gap-2"><ChevronLeft className="h-4 w-4" /> Back</button>
                  <button onClick={() => setStep(3)} className="bg-green text-app px-8 py-3 rounded-xl font-bold hover:bg-green/90 flex items-center gap-2">Next <ChevronRight className="h-4 w-4" /></button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" custom={1} variants={variants} initial="enter" animate="center" exit="exit" className="flex-1">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-display font-bold mb-2">Quick setup</h2>
                  <p className="text-secondary">Choose your initial preferences. The full annual assessment is available in your profile.</p>
                </div>
                
                <div className="space-y-6 max-w-md mx-auto">
                  <div>
                    <label className="block text-sm font-medium mb-3">Primary Transport</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['car', 'public', 'bike'].map(t => (
                        <button key={t} onClick={() => setPreferences({...preferences, transport: t})} className={`py-3 px-4 rounded-xl border text-sm capitalize ${preferences.transport === t ? 'bg-green/10 border-green text-green' : 'bg-widget border-glass-border text-secondary'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-3">Diet Preference</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['meat', 'mixed', 'vegetarian'].map(d => (
                        <button key={d} onClick={() => setPreferences({...preferences, diet: d})} className={`py-3 px-4 rounded-xl border text-sm capitalize ${preferences.diet === d ? 'bg-cyan/10 border-cyan text-cyan' : 'bg-widget border-glass-border text-secondary'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex justify-between max-w-md mx-auto">
                  <button onClick={() => setStep(2)} className="px-6 py-3 text-secondary hover:text-main flex items-center gap-2"><ChevronLeft className="h-4 w-4" /> Back</button>
                  <button onClick={handleComplete} className="bg-green text-app px-8 py-3 rounded-xl font-bold hover:bg-green/90 flex items-center gap-2">Complete Setup <CheckCircle className="h-4 w-4" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
