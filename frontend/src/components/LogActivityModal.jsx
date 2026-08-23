import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Zap, Utensils, Monitor, CheckCircle } from 'lucide-react';

const categories = [
  { id: 'transport', label: 'Transport', icon: Car, factor: 0.2 }, // 0.2 kg per unit (miles/km)
  { id: 'electricity', label: 'Electricity', icon: Zap, factor: 0.5 }, // 0.5 kg per kWh
  { id: 'food', label: 'Food', icon: Utensils, factor: 1.2 }, // 1.2 kg per meal
  { id: 'devices', label: 'Devices', icon: Monitor, factor: 0.1 } // 0.1 kg per hour
];

export default function LogActivityModal({ open, onClose }) {
  const [selectedCat, setSelectedCat] = useState('transport');
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const currentCat = categories.find(c => c.id === selectedCat);
  const calculatedCO2 = amount ? (parseFloat(amount) * currentCat.factor).toFixed(1) : '0.0';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount)) return;
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setAmount('');
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-panel border border-glass-border p-6 rounded-3xl shadow-2xl w-full max-w-md relative"
        >
          <button onClick={onClose} className="absolute right-4 top-4 p-2 bg-widget rounded-full hover:bg-glass-hover-bg">
            <X className="h-4 w-4" />
          </button>
          
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="h-16 w-16 text-green mb-4" />
              <h3 className="text-2xl font-bold text-main">Activity Logged!</h3>
              <p className="text-secondary mt-2">Added +{calculatedCO2} kg CO&#x2082; to your tracker.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-display font-bold mb-6">Log Activity</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-sm font-mono-data text-secondary block mb-3">CATEGORY</label>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map(cat => {
                      const Icon = cat.icon;
                      const active = selectedCat === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCat(cat.id)}
                          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                            active ? 'bg-green/10 border-green text-main' : 'bg-widget border-glass-border text-secondary hover:text-main hover:bg-glass-hover-bg'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${active ? 'text-green' : ''}`} />
                          <span className="text-sm font-medium">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-mono-data text-secondary block mb-3">AMOUNT (UNIT)</label>
                  <input 
                    type="number"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-widget border border-glass-border p-4 rounded-xl text-main placeholder:text-secondary/50 focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                  />
                </div>

                <div className="bg-glass-bg p-4 rounded-xl border border-glass-border flex justify-between items-center">
                  <span className="text-secondary text-sm">Estimated Impact:</span>
                  <span className="font-mono-data font-bold text-green text-xl">+{calculatedCO2} kg CO&#x2082;</span>
                </div>

                <button 
                  type="submit"
                  disabled={!amount}
                  className="w-full bg-green text-app font-bold p-4 rounded-xl hover:bg-green/90 transition-all disabled:opacity-50"
                >
                  Save Activity
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
