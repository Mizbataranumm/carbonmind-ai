import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Phone, PhoneOff, X } from "lucide-react";
import { triggerPhoneCall } from "@/lib/api";

export default function PhoneCallModal({ open, onClose, userName = "Explorer", todayKg = 0, topCategory = "No recorded category" }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("editing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setPhone("");
      setStatus("editing");
      setMessage("");
    }
  }, [open]);

  const close = () => {
    if (status !== "calling") onClose();
  };

  const requestCall = async () => {
    const number = phone.trim();
    if (!/^\+?[1-9]\d{9,14}$/.test(number.replace(/[\s()-]/g, ""))) {
      setStatus("editing");
      setMessage("Enter a valid international phone number, including the country code.");
      return;
    }

    setStatus("calling");
    setMessage("");
    try {
      const response = await triggerPhoneCall({ phone_number: number });
      if (response.demo) {
        setStatus("unavailable");
        setMessage("Phone briefings are not enabled for this deployment. Use Daily audio brief for the same saved-record summary in the app.");
        return;
      }
      setStatus("requested");
    } catch (error) {
      setStatus("error");
      setMessage(error?.response?.data?.detail || "We could not request the phone briefing. Please try again later.");
    }
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
            <button type="button" onClick={close} disabled={status === "calling"} className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-widget hover:text-main disabled:opacity-50" aria-label="Close phone briefing">
              <X className="h-4 w-4" />
            </button>

            <div className="pr-10">
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// One-way phone audio</div>
              <h2 className="mt-1 font-display text-2xl text-main">Phone briefing</h2>
              <p className="mt-2 text-sm leading-relaxed text-secondary">Receive a one-way reading of your saved carbon record. This call does not listen, record your answers, or provide a two-way AI conversation.</p>
            </div>

            {status === "editing" && (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-glass-border bg-widget p-4 text-sm">
                  <div className="flex justify-between gap-4 text-secondary"><span>Saved today</span><span className="font-mono-data text-main">{Number(todayKg).toFixed(1)} kg CO2e</span></div>
                  <div className="mt-2 flex justify-between gap-4 text-secondary"><span>Largest category</span><span className="text-right text-main">{topCategory}</span></div>
                </div>
                <div>
                  <label htmlFor="phone-briefing-number" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Phone number</label>
                  <input id="phone-briefing-number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" className="input-glass mt-2" />
                  <p className="mt-2 text-xs text-secondary">{userName}, include your country code. Standard carrier charges may apply.</p>
                </div>
                {message && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{message}</p>}
                <button type="button" onClick={requestCall} className="btn-primary flex w-full items-center justify-center gap-2 !py-3.5"><Phone className="h-4 w-4" /> Request phone briefing</button>
              </div>
            )}

            {status === "calling" && <div className="flex min-h-64 flex-col items-center justify-center text-center"><Loader2 className="h-12 w-12 animate-spin text-green" /><h3 className="mt-4 font-display text-xl text-main">Requesting your briefing</h3><p className="mt-2 text-sm text-secondary">Connecting to {phone}</p></div>}

            {status === "requested" && <div className="flex min-h-64 flex-col items-center justify-center text-center"><CheckCircle2 className="h-14 w-14 text-green" /><h3 className="mt-4 font-display text-xl text-main">Phone briefing requested</h3><p className="mt-2 text-sm text-secondary">Answer the call to hear the one-way summary of your saved record.</p><button type="button" onClick={onClose} className="mt-6 w-full rounded-xl border border-glass-border bg-widget py-3 text-sm font-semibold text-main hover:bg-glass-hover-bg">Close</button></div>}

            {status === "unavailable" && <div className="mt-6 flex flex-col items-center text-center"><AlertCircle className="h-12 w-12 text-[#FFD166]" /><h3 className="mt-4 font-display text-xl text-main">Phone briefing unavailable</h3><p className="mt-2 text-sm leading-relaxed text-secondary">{message}</p><button type="button" onClick={onClose} className="mt-6 w-full rounded-xl border border-glass-border bg-widget py-3 text-sm font-semibold text-main hover:bg-glass-hover-bg">Close</button></div>}

            {status === "error" && <div className="mt-6 flex flex-col items-center text-center"><PhoneOff className="h-12 w-12 text-red-400" /><h3 className="mt-4 font-display text-xl text-main">Could not request briefing</h3><p className="mt-2 text-sm leading-relaxed text-secondary">{message}</p><button type="button" onClick={() => { setStatus("editing"); setMessage(""); }} className="mt-6 w-full rounded-xl border border-glass-border bg-widget py-3 text-sm font-semibold text-main hover:bg-glass-hover-bg">Try again</button></div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
