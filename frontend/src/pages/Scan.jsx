import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Upload, Sparkles, ScanLine, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { saveDailyActivities, scanFood, submitFoodFeedback } from "@/lib/api";
import { useUser } from "@/lib/UserContext";
import { toast } from "sonner";

function createMealEventId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `meal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const Scan = () => {
  const { user } = useUser();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const [mealEventId, setMealEventId] = useState(null);
  const [correction, setCorrection] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
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
    prepareImageForReview(dataUrl);
    stopCamera();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      prepareImageForReview(dataUrl);
    };
    reader.readAsDataURL(file);
    // Allow choosing the same image again after clearing or correcting a scan.
    e.target.value = "";
  };

  const presentScanResult = (scanData) => {
    setResult(scanData);
    setRecordSaved(false);
    setMealEventId(createMealEventId());
    setCorrection("");
    setFeedbackSaved(false);
  };

  const prepareImageForReview = (dataUrl) => {
    setPreviewImg(dataUrl);
    setResult(null);
    setError("");
    setRecordSaved(false);
    setMealEventId(null);
    setCorrection("");
    setFeedbackSaved(false);
  };

  const runScan = async (dataUrl, explicitHint) => {
    const currentHint = (explicitHint !== undefined ? explicitHint : hint).trim();
    if (!currentHint) {
      setError("Enter or select the dish name before verifying this photo.");
      toast.error("Dish name required before verification");
      return;
    }
    setScanning(true);
    setError("");
    setResult(null);

    try {
      const [response] = await Promise.all([
        scanFood({ image_base64: dataUrl?.split(",")[1] || null, hint: currentHint }),
        new Promise(res => setTimeout(res, 900)),
      ]);
      if (!response || response.status !== "success" || !response.data) {
        setError(response?.message || "We could not verify that this photo matches the dish name.");
        toast.error("Photo and dish name were not verified");
        return;
      }

      presentScanResult(response.data);
      toast.success("Meal estimate ready for your review");
    } catch (e) {
      console.error("Scan error:", e);
      setError("Photo verification is unavailable right now. No estimate was created.");
      toast.error("Photo verification unavailable");
    } finally {
      setScanning(false);
    }
  };

  const handleTagClick = (tagLabel) => {
    setHint(tagLabel);
    setError("");
  };

  const reset = () => {
    setResult(null);
    setPreviewImg(null);
    setError("");
    setHint("");
    setRecordSaved(false);
    setMealEventId(null);
    setCorrection("");
    setFeedbackSaved(false);
  };

  const saveMealToRecord = async () => {
    if (!user?.id || !result || savingRecord || recordSaved) return;
    setSavingRecord(true);
    try {
      await saveDailyActivities({
        user_id: user.id,
        append: true,
        activities: [{
          type: "food",
          kg: Number(result.total_co2_kg) || 0,
          label: result.items?.[0]?.name || result.name || "Confirmed meal",
          event_id: mealEventId || createMealEventId(),
        }],
      });
      setRecordSaved(true);
      toast.success("Meal added to today’s activity record");
    } catch {
      toast.error("Could not save this meal to your activity record");
    } finally {
      setSavingRecord(false);
    }
  };

  const saveCorrection = async () => {
    const confirmedFood = correction.trim();
    if (!user?.id || !result || !confirmedFood || savingFeedback || feedbackSaved) return;
    setSavingFeedback(true);
    try {
      await submitFoodFeedback({
        predicted_food: result.items?.[0]?.name || result.name || null,
        confirmed_food: confirmedFood,
        scan_method: result.method || null,
      });
      setFeedbackSaved(true);
      toast.success("Dish correction saved for model review");
    } catch {
      toast.error("Could not save the dish correction");
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="scan-root">
      {/* Header */}
      <div className="glass p-4 sm:p-6 lg:p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Novel Feature 03</div>
            <h2 className="font-display text-2xl sm:text-3xl mt-1">Food Carbon Scanner</h2>
            <p className="text-sm text-secondary mt-2 max-w-2xl">
              Upload a meal photo and provide its dish name. An estimate is shown only when the image candidate and dish name agree.
            </p>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-green/10 text-green border border-green/25">
            Photo-name verification
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera / preview panel */}
        <div className="glass p-4 sm:p-6 glass-hover min-w-0">
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
                <div className="text-sm text-[#5C6B7A] mt-1">Start camera or upload a photo of your food</div>
              </div>
            )}

            {scanning && (
              <div className="absolute inset-0 bg-app/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="h-10 w-10 rounded-full border-2 border-[#00FFB2] border-t-transparent"
                />
                <div className="font-mono-data text-xs text-green mt-3 uppercase tracking-widest">Analyzing meal candidate...</div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {/* Action buttons */}
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

            {previewImg && (
              <button
                onClick={() => runScan(previewImg)}
                disabled={scanning || !hint.trim()}
                className="btn-primary text-sm inline-flex items-center gap-2"
                data-testid="analyze-meal-btn"
                title={!hint.trim() ? "Enter or select a dish name first" : "Verify this meal"}
              >
                <Sparkles className="h-4 w-4" /> {scanning ? "Verifying..." : "Verify meal"}
              </button>
            )}

            {previewImg && !scanning && (
              <button onClick={reset} className="btn-ghost text-sm inline-flex items-center gap-2" data-testid="reset-scan-btn">
                <RefreshCw className="h-4 w-4" /> Clear & Reset
              </button>
            )}

            <label className="btn-ghost text-sm inline-flex items-center gap-2 cursor-pointer" data-testid="upload-btn">
              <Upload className="h-4 w-4" /> Upload photo
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>

          {/* Hint input & quick select pills */}
          <div className="mt-4">
            <label htmlFor="scan-hint" className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">
              Dish name to verify <span className="text-green">(required)</span>
            </label>
            <input
              id="scan-hint"
              value={hint}
              onChange={(e) => {
                setHint(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. French Fries, Chicken Biryani, Veg Biryani..."
              className="input-glass !py-2 !px-3 text-sm mt-1"
              data-testid="scan-hint"
            />
            <p className="mt-1.5 text-xs text-secondary">The photo and selected dish must agree before an estimate can be shown.</p>

            {/* Quick 1-click preset badges */}
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
              <span className="font-mono-data text-[9px] uppercase tracking-wider text-secondary mr-1">Quick Select:</span>
              {[
                { dish: "French Fries", label: "🍟 French Fries" },
                { dish: "Chicken Biryani", label: "🍗 Chicken Biryani" },
                { dish: "Veg Biryani", label: "🍚 Veg Biryani" },
                { dish: "Indian Thali", label: "🍛 Indian Thali" },
                { dish: "Margherita Pizza", label: "🍕 Margherita Pizza" },
                { dish: "Beef Burger", label: "🍔 Beef Burger" },
                { dish: "Garden Salad", label: "🥗 Garden Salad" },
                { dish: "Tomato Pasta", label: "🍝 Tomato Pasta" },
                { dish: "Coffee", label: "☕ Coffee" },
              ].map((pill) => (
                <button
                  key={pill.dish}
                  type="button"
                  onClick={() => handleTagClick(pill.dish)}
                  className="text-xs px-2.5 py-1 rounded-full bg-widget border border-glass-border hover:border-green/40 hover:bg-green/10 text-secondary hover:text-white transition"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="glass p-4 sm:p-6 glass-hover min-w-0" data-testid="scan-results">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Detected items</div>
          <div className="font-display text-xl mt-1">Meal breakdown</div>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Scan needs review</div>
                  <div className="text-xs mt-1 text-red-300/80 leading-relaxed">{error}</div>
                </div>
              </div>
            </motion.div>
          )}

          {!result && !scanning && !error && (
            <div className="text-sm text-secondary mt-6 text-center py-16">
              <Sparkles className="h-8 w-8 text-green/40 mx-auto mb-2" />
              {previewImg
                ? "Add or select the dish name, then verify that it matches this photo."
                : "Upload a meal photo or start the camera to begin."}
            </div>
          )}

          {scanning && (
            <div className="mt-6 space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl bg-widget animate-pulse" />
              ))}
            </div>
          )}

          <AnimatePresence>
            {result && !scanning && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <div className="p-4 rounded-xl bg-green/5 border border-green/20">
                  <div className="font-mono-data text-[11px] text-secondary uppercase tracking-widest">Total meal impact</div>
                  <div className="font-mono-data text-4xl neon-text-green mt-1">
                    {result.total_co2_kg} <span className="text-lg text-secondary">kg CO₂</span>
                  </div>
                  <div className="text-sm text-main mt-2">{result.ai_note}</div>
                  {result.image_candidate && (
                    <div className="mt-3 text-xs text-secondary border-l-2 border-green/50 pl-3">
                      Photo candidate: <span className="text-main font-medium">{result.image_candidate}</span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-2.5 rounded-lg bg-green/10 border border-green/30 text-xs">
                    <button onClick={saveMealToRecord} disabled={savingRecord || recordSaved} className="flex items-center gap-1.5 text-green font-medium disabled:opacity-70">
                      <CheckCircle2 className="h-4 w-4" /> {recordSaved ? "Added to today’s record" : savingRecord ? "Saving..." : "Confirm and add to today"}
                    </button>
                    <Link to="/tracker" className="text-green underline font-medium hover:text-white transition">
                      View record →
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
                    <label className="w-full flex-1 min-w-0">
                      <span className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">Correct dish name</span>
                      <input
                        value={correction}
                        onChange={(event) => { setCorrection(event.target.value); setFeedbackSaved(false); }}
                        placeholder="Only when the result needs correction"
                        maxLength={120}
                        className="input-glass !py-2 !px-3 text-sm w-full mt-1"
                      />
                    </label>
                    <button
                      onClick={saveCorrection}
                      disabled={!correction.trim() || savingFeedback || feedbackSaved}
                      className="self-end flex items-center gap-1.5 px-3 py-2 rounded-lg border border-glass-border text-xs text-secondary hover:text-green hover:border-green/30 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" /> {feedbackSaved ? "Saved" : savingFeedback ? "Saving..." : "Save correction"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">
                    Individual Components
                  </div>
                  {result.items?.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="p-3 rounded-xl bg-widget border border-glass-border"
                      data-testid={`food-item-${i}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-main">{item.name}</div>
                          <div className="font-mono-data text-[11px] text-secondary">{item.portion} · {item.category}</div>
                        </div>
                        <div className="font-mono-data text-lg text-green shrink-0">{item.co2_kg} kg</div>
                      </div>
                      {item.tip && <div className="text-[11px] text-secondary mt-1.5 italic">💡 {item.tip}</div>}
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
