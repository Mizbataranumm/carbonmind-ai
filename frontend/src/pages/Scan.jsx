import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Upload, Sparkles, ScanLine, RefreshCw, X } from "lucide-react";
import { scanFood } from "@/lib/api";

const Scan = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setError("Camera access denied. You can still upload a photo below.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const snap = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.7);
    setPreviewImg(dataUrl);
    await runScan(dataUrl);
    stopCamera();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreviewImg(dataUrl);
      await runScan(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runScan = async (dataUrl) => {
    setScanning(true);
    setResult(null);
    try {
      // Simulate a bit of AI thinking time for cinematic effect
      const [r] = await Promise.all([
        scanFood({ image_base64: dataUrl?.split(",")[1] || null, hint: hint || null }),
        new Promise(res => setTimeout(res, 1600)),
      ]);
      if (r.status === "error") { setError(r.message + (r.suggestion ? " - " + r.suggestion : "")); setResult(null); } else { setResult(r.data); };
    } catch (e) {
      setError("Scan failed. Try again.");
    } finally { setScanning(false); }
  };

  const reset = () => {
    setResult(null); setPreviewImg(null); setError(""); setHint("");
  };

  return (
    <div className="space-y-6" data-testid="scan-root">
      <div className="glass p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Novel Feature 03</div>
            <h2 className="font-display text-3xl mt-1">Food Carbon Scanner</h2>
            <p className="text-sm text-secondary mt-2 max-w-2xl">
              Point your camera at a meal or a menu. AI identifies items in seconds and shows
              the COâ‚‚ footprint of your plate  ” zero manual entry.
            </p>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-green/10 text-green border border-green/25">
            IPCC food factors
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera / preview panel */}
        <div className="glass p-6 glass-hover">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Capture</div>
          <div className="relative mt-3 aspect-video w-full rounded-xl overflow-hidden bg-widget border border-glass-border flex items-center justify-center">
            {/* Always render video so ref exists when attaching stream */}
            <video 
              ref={videoRef} 
              className={`w-full h-full object-cover ${(!cameraOn || previewImg) ? "hidden" : ""}`} 
              playsInline 
              autoPlay 
              muted 
            />
            
            {previewImg && (
              <img src={previewImg} alt="Scanned meal" className="absolute inset-0 w-full h-full object-cover z-10" data-testid="scan-preview" />
            )}
            
            {cameraOn && !previewImg && (
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute inset-6 border-2 border-[#00FFB2]/50 rounded-2xl" />
                <motion.div
                  className="absolute left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-[#00FFB2] to-transparent"
                  animate={{ top: ["10%", "88%", "10%"] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ boxShadow: "0 0 12px #00FFB2" }}
                />
              </div>
            )}
            
            {!cameraOn && !previewImg && (
              <div className="text-center p-8 z-10 absolute inset-0 flex flex-col items-center justify-center">
                <ScanLine className="h-12 w-12 text-green mx-auto opacity-40" />
                <div className="font-mono-data text-xs text-secondary mt-3 uppercase tracking-widest">Camera inactive</div>
                <div className="text-sm text-[#5C6B7A] mt-1">Start camera or upload a photo</div>
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 bg-app/70 backdrop-blur-sm flex flex-col items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="h-10 w-10 rounded-full border-2 border-[#00FFB2] border-t-transparent"
                />
                <div className="font-mono-data text-xs text-green mt-3 uppercase tracking-widest">AI analyzing food...</div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!cameraOn && !previewImg && (
              <button onClick={startCamera} className="btn-primary text-sm inline-flex items-center gap-2" data-testid="start-camera-btn">
                <Camera className="h-4 w-4" /> Start camera
              </button>
            )}
            {cameraOn && (
              <>
                <button onClick={snap} className="btn-primary text-sm inline-flex items-center gap-2" data-testid="snap-btn">
                  <Sparkles className="h-4 w-4" /> Scan meal
                </button>
                <button onClick={stopCamera} className="btn-ghost text-sm inline-flex items-center gap-2" data-testid="stop-camera-btn">
                  <CameraOff className="h-4 w-4" /> Stop
                </button>
              </>
            )}
            {previewImg && !scanning && (
              <button onClick={reset} className="btn-ghost text-sm inline-flex items-center gap-2" data-testid="reset-scan-btn">
                <RefreshCw className="h-4 w-4" /> Scan another
              </button>
            )}
            <label className="btn-ghost text-sm inline-flex items-center gap-2 cursor-pointer" data-testid="upload-btn">
              <Upload className="h-4 w-4" /> Upload photo
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>

          <div className="mt-4">
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Hint (optional)</label>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g. burger, pizza, salad..."
              className="input-glass !py-2 !px-3 text-sm mt-1"
              data-testid="scan-hint"
            />
          </div>

          {error && <div className="mt-3 text-xs text-[#FFD166]">{error}</div>}
        </div>

        {/* Results */}
        <div className="glass p-6 glass-hover" data-testid="scan-results">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Detected items</div>
          <div className="font-display text-xl mt-1">Meal breakdown</div>

          {!result && !scanning && (
            <div className="text-sm text-secondary mt-6 text-center py-12">
              Scan a meal to see instant COâ‚‚ analysis
            </div>
          )}

          {scanning && (
            <div className="mt-6 space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-14 rounded-xl bg-widget animate-pulse" />
              ))}
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <div className="p-4 rounded-xl bg-green/5 border border-green/20">
                  <div className="font-mono-data text-[11px] text-secondary">Total meal impact</div>
                  <div className="font-mono-data text-4xl neon-text-green mt-1">{result.total_co2_kg} <span className="text-lg text-secondary">kg COâ‚‚</span></div>
                  <div className="text-sm text-main mt-2">{result.ai_note}</div>
                </div>

                <div className="mt-4 space-y-2">
                  {result.items.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="p-3 rounded-xl bg-widget border border-glass-border"
                      data-testid={`food-item-${i}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="font-mono-data text-[11px] text-secondary">{item.portion} Â· {item.category}</div>
                        </div>
                        <div className="font-mono-data text-lg text-green">{item.co2_kg} kg</div>
                      </div>
                      <div className="text-[11px] text-secondary mt-1.5 italic">ðŸ’¡ {item.tip}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Scan;

