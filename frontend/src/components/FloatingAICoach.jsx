import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, X, Sparkles, Plus } from 'lucide-react';
import { sendChat } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';

export default function FloatingAICoach() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hey! I'm your CarbonMind AI Coach. Ask me anything about reducing your carbon footprint — food, transport, energy, tips, or your score!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => 'coach-' + Date.now());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await sendChat(sessionId, userMsg);
      const reply = res?.reply || res?.message;
      if (reply) {
        setMessages(prev => [...prev, { role: 'ai', text: reply }]);
      } else throw new Error('empty');
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: "Try asking about food emissions, transport tips, energy savings, or your carbon score!" }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full bg-green text-app flex items-center justify-center transition-all z-50 hover:scale-105 shadow-[0_0_20px_rgba(0,255,178,0.4)] ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <Bot className="h-7 w-7" />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-[340px] h-[450px] border border-glass-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden" style={{ background: "var(--app-bg)", boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-glass-border" style={{ background: "var(--bg-secondary)" }}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan/10"><Sparkles className="h-4 w-4 text-cyan" /></div>
                <span className="font-bold text-base text-main">AI Coach</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20">● LIVE</span>
                <button onClick={() => setIsOpen(false)} className="text-secondary hover:text-main transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`text-sm px-3 py-2 rounded-xl leading-relaxed border ${
                  msg.role === 'ai' ? 'border-glass-border text-main' : 'ml-4 border-green/30 bg-green/10 text-main'
                }`} style={{ background: msg.role === 'ai' ? "var(--bg-secondary)" : undefined }}>
                  {msg.role === 'ai' && <span className="text-green font-bold text-[10px] block mb-0.5 uppercase tracking-widest">Coach</span>}
                  {msg.text}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-glass-border text-secondary" style={{ background: "var(--bg-secondary)" }}>
                  <Loader2 className="h-3 w-3 animate-spin text-green" /> Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-glass-border" style={{ background: "var(--bg-secondary)" }}>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleSend()}
                  placeholder="Ask a question..."
                  className="flex-1 border border-glass-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green/50 transition-colors placeholder:text-secondary"
                  style={{ background: "var(--app-bg)", color: "var(--text-primary)" }}
                />
                <button onClick={handleSend} disabled={loading || !input.trim()}
                  className="bg-green text-app p-2.5 rounded-xl hover:bg-green/90 transition-all disabled:opacity-40 flex-shrink-0">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
