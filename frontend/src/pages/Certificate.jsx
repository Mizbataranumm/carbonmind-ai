import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Share2, Leaf, Award, TreePine, Car, CheckCircle2, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { generateCertificate } from "@/lib/api";
import { useUser } from "@/lib/UserContext";

const Certificate = () => {
  const { user } = useUser();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(user?.xp === 0 ? 0 : 24.8);
  const certRef = useRef(null);

  const issue = async () => {
    setLoading(true);
    try {
      const r = await generateCertificate({ user_name: user?.name || "Eco Explorer", co2_saved_kg: saved, grade: user?.grade || "A-" });
      setCert(r);
    } finally { setLoading(false); }
  };

  useEffect(() => { issue(); /* eslint-disable-next-line */ }, []);

  const download = async () => {
    if (!certRef.current) return;
    try {
      const dataUrl = await toPng(certRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "var(--app-bg)",
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `carbonmind-certificate-${cert.cert_id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Certificate downloaded", { description: cert.cert_id });
    } catch (e) {
      toast.error("Download failed. Try again.");
    }
  };

  const share = async () => {
    if (!cert) return;
    const text = `I just earned my CarbonMind AI carbon reduction certificate — saved ${cert.co2_saved_kg} kg CO₂ this ${cert.month}! 🌱`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "CarbonMind Certificate", text, url: cert.verify_url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text} ${cert.verify_url}`);
      toast.success("Copied to clipboard", { description: "Ready to share on LinkedIn / Instagram" });
    }
  };

  if (!cert) return (
    <div className="font-mono-data text-secondary">Generating certificate...</div>
  );

  return (
    <div className="space-y-6" data-testid="certificate-root">
      <div className="glass p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Novel Feature 04</div>
            <h2 className="font-display text-3xl mt-1">Verified Carbon Certificate</h2>
            <p className="text-sm text-secondary mt-2 max-w-2xl">
              Monthly, verifiable carbon reduction certificate — shareable on LinkedIn or Instagram.
              Real-world social incentive that outlasts short-term gamification.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={download} className="btn-primary text-sm inline-flex items-center gap-2" data-testid="cert-download-btn">
              <Download className="h-4 w-4" /> Download PNG
            </button>
            <button onClick={share} className="btn-ghost text-sm inline-flex items-center gap-2" data-testid="cert-share-btn">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">CO₂ saved this month</label>
          <input
            type="number" step="0.1" value={saved}
            onChange={(e) => setSaved(parseFloat(e.target.value) || 0)}
            className="input-glass !py-2 !px-3 text-sm w-36"
            data-testid="cert-saved-input"
          />
          <button onClick={issue} disabled={loading} className="btn-ghost text-sm inline-flex items-center gap-2" data-testid="cert-reissue-btn">
            <Sparkles className="h-4 w-4" /> {loading ? "Issuing..." : "Re-issue"}
          </button>
        </div>
      </div>

      {/* THE CERTIFICATE — captured to PNG */}
      {user?.xp === 0 && saved === 0 ? (
        <div className="text-center py-20 glass rounded-3xl border border-dashed border-glass-border flex flex-col items-center">
          <Award className="h-12 w-12 text-secondary mb-4 opacity-50" />
          <h3 className="font-display text-2xl">No emissions tracked yet</h3>
          <p className="text-secondary mt-2 max-w-md">
            Start logging your daily transport, meals, and energy usage. 
            Once you generate carbon savings, you can issue your first verified certificate!
          </p>
        </div>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center"
      >
        <div
          ref={certRef}
          className="relative w-full max-w-3xl rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #071014 0%, #0a1f27 50%, #071014 100%)",
            padding: 48,
            border: "1px solid rgba(0,255,178,0.25)",
            boxShadow: "0 0 60px rgba(0,255,178,0.15)",
          }}
          data-testid="certificate-visual"
        >
          {/* Neon corner brackets */}
          <div className="absolute top-6 left-6 h-8 w-8 border-t-2 border-l-2 border-[#00FFB2]" />
          <div className="absolute top-6 right-6 h-8 w-8 border-t-2 border-r-2 border-[#00FFB2]" />
          <div className="absolute bottom-6 left-6 h-8 w-8 border-b-2 border-l-2 border-[#00FFB2]" />
          <div className="absolute bottom-6 right-6 h-8 w-8 border-b-2 border-r-2 border-[#00FFB2]" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#00FFB2,#00D9FF)" }}>
                <Leaf className="h-4 w-4" style={{ color: "var(--app-bg)" }} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>CarbonMind</div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--neon-green)", letterSpacing: "0.15em" }}>AI · CERTIFIED</div>
              </div>
            </div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-muted)" }}>
              {cert.cert_id}
            </div>
          </div>

          {/* Body */}
          <div className="text-center mt-10">
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--neon-green)", letterSpacing: "0.25em", textTransform: "uppercase" }}>
              Certificate of Carbon Reduction
            </div>
            <div className="mt-2" style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
              This is to certify that
            </div>
            <h1 style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.05,
              marginTop: 8,
              background: "linear-gradient(135deg, #00FFB2 0%, #00D9FF 60%, #FFFFFF 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}>
              {cert.user_name}
            </h1>
            <div className="mt-4 max-w-xl mx-auto" style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, color: "#cfd8e0", lineHeight: 1.6 }}>
              has demonstrated measurable and verifiable sustainable action for{" "}
              <span style={{ color: "var(--neon-green)", fontWeight: 600 }}>{cert.month}</span>,
              reducing personal carbon emissions and contributing to a lighter planet.
            </div>
          </div>

          {/* Metric block */}
          <div
            className="mt-8 mx-auto"
            style={{
              maxWidth: 560,
              background: "rgba(0,255,178,0.05)",
              border: "1px solid rgba(0,255,178,0.2)",
              borderRadius: 20,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Total CO₂ Reduced
            </div>
            <div style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 64,
              fontWeight: 700,
              color: "var(--neon-green)",
              lineHeight: 1,
              marginTop: 6,
              textShadow: "0 0 30px rgba(0,255,178,0.4)",
            }}>
              {cert.co2_saved_kg}<span style={{ fontSize: 20, color: "var(--text-muted)", marginLeft: 4 }}>kg</span>
            </div>

            {/* Equivalents */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <EquivBox icon={<TreePine size={16} />} value={cert.equivalents.trees_planted_equivalent} label="trees eq." />
              <EquivBox icon={<Car size={16} />} value={cert.equivalents.km_by_car_avoided} label="km car avoided" />
              <EquivBox icon={<Award size={16} />} value={cert.grade} label="grade" />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 flex items-end justify-between">
            <div>
              <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, color: "#cfd8e0", fontStyle: "italic" }}>
                CarbonMind AI
              </div>
              <div style={{ width: 160, height: 1, background: "rgba(255,255,255,0.15)", marginTop: 4 }} />
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#5C6B7A", marginTop: 4 }}>
                Digital Signature
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: "var(--neon-green)" }} />
              <div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--neon-green)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Blockchain Verified
                </div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#5C6B7A", marginTop: 2, maxWidth: 250, wordBreak: "break-all" }}>
                  {cert.signature}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      )}
    </div>
  );
};

const EquivBox = ({ icon, value, label }) => (
  <div style={{
    padding: 10,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    textAlign: "center",
  }}>
    <div style={{ color: "var(--neon-green)", display: "flex", justifyContent: "center" }}>{icon}</div>
    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 16, color: "#fff", marginTop: 4, fontWeight: 700 }}>{value}</div>
    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
  </div>
);

export default Certificate;
