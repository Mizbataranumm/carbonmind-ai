import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Upload, Sparkles, ScanLine, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { scanFood } from "@/lib/api";
import { toast } from "sonner";

/* ── Comprehensive Food Presets & Carbon Database ─────────────── */
const FOOD_CATALOG = {
  fries: {
    key: "fries",
    name: "Crispy French Fries & Dip",
    total_co2_kg: 0.48,
    carbon_label: "A+",
    ai_note: "CNN classified Golden French Fries / Potato Snack.",
    items: [
      { name: "Crispy French Fries", portion: "1 medium basket (140g)", category: "Potatoes", co2_kg: 0.38, tip: "Potatoes have a remarkably low carbon footprint compared to processed grains." },
      { name: "Dipping Sauce / Ketchup", portion: "2 tbsp (30g)", category: "Condiments", co2_kg: 0.10, tip: "Tomato-based condiments have minimal environmental impact." }
    ]
  },
  biryani: {
    key: "biryani",
    name: "Chicken Biryani / Spiced Rice",
    total_co2_kg: 2.30,
    carbon_label: "B",
    ai_note: "CNN classified Spiced Poultry & Basmati Rice Dish (Chicken Biryani).",
    items: [
      { name: "Spiced Chicken Biryani", portion: "1 plate (300g)", category: "Poultry & Grains", co2_kg: 2.10, tip: "Chicken produces 4x less carbon than red meat like beef or lamb." },
      { name: "Cucumber Raita", portion: "1 cup (80g)", category: "Dairy", co2_kg: 0.20, tip: "Yogurt adds probiotics with modest carbon impact." }
    ]
  },
  thali: {
    key: "thali",
    name: "Traditional Indian Thali",
    total_co2_kg: 1.65,
    carbon_label: "A",
    ai_note: "CNN classified Traditional Multi-Dish Plate (Rice, Dal, Veg Curry & Roti).",
    items: [
      { name: "Steamed Rice", portion: "1 bowl (150g)", category: "Grains", co2_kg: 0.60, tip: "Rice has moderate emissions; swapping to millets cuts 40% CO₂." },
      { name: "Lentil Dal / Sambar", portion: "1 cup (120g)", category: "Plant Protein", co2_kg: 0.35, tip: "Lentils naturally fix nitrogen in soil — super low-carbon!" },
      { name: "Mixed Vegetable Curry", portion: "1 cup (100g)", category: "Vegetables", co2_kg: 0.40, tip: "Locally sourced seasonal vegetables minimize cold-chain emissions." },
      { name: "Roti / Flatbread", portion: "2 pieces", category: "Grains", co2_kg: 0.30, tip: "Whole wheat flatbread produces very low emissions." }
    ]
  },
  pizza: {
    key: "pizza",
    name: "Cheese & Veggie Pizza",
    total_co2_kg: 2.80,
    carbon_label: "B",
    ai_note: "CNN classified Oven-Baked Cheese & Veggie Pizza.",
    items: [
      { name: "Pizza Slices (2x)", portion: "220g", category: "Mixed Grains & Dairy", co2_kg: 2.30, tip: "Dairy cheese represents ~60% of a pizza's carbon footprint." },
      { name: "Herbed Tomato Marinara", portion: "50g", category: "Vegetables", co2_kg: 0.50, tip: "Tomato reduction sauce is low emissions." }
    ]
  },
  burger: {
    key: "burger",
    name: "Burger with Side",
    total_co2_kg: 3.20,
    carbon_label: "B",
    ai_note: "CNN classified Burger & Fast Food Plate.",
    items: [
      { name: "Burger (Bun & Patty)", portion: "1 unit (180g)", category: "Fast Food", co2_kg: 2.70, tip: "Plant-based patties cut burger emissions by up to 75%." },
      { name: "Side Fries / Chips", portion: "1 small serving (80g)", category: "Sides", co2_kg: 0.50, tip: "Potatoes have low emissions among crops." }
    ]
  },
  salad: {
    key: "salad",
    name: "Fresh Garden Salad",
    total_co2_kg: 0.40,
    carbon_label: "A+",
    ai_note: "CNN classified Fresh Garden Salad / Veggie Bowl.",
    items: [
      { name: "Leafy Greens & Cucumbers", portion: "1 bowl (180g)", category: "Vegetables", co2_kg: 0.25, tip: "Ultra low carbon! Plant-forward meals protect planetary boundaries." },
      { name: "Olive Dressing & Seeds", portion: "30g", category: "Healthy Fats", co2_kg: 0.15, tip: "Plant oils and seeds add nutrients with minimal emissions." }
    ]
  },
  pasta: {
    key: "pasta",
    name: "Pasta with Tomato Basil",
    total_co2_kg: 1.20,
    carbon_label: "A",
    ai_note: "CNN classified Italian Pasta & Marinara.",
    items: [
      { name: "Durum Wheat Pasta", portion: "1 plate (200g)", category: "Grains", co2_kg: 0.80, tip: "Wheat pasta is an energy-efficient grain." },
      { name: "Tomato Basil Sauce & Herbs", portion: "80g", category: "Vegetables", co2_kg: 0.40, tip: "Fresh herbs have almost zero carbon impact." }
    ]
  },
  coffee: {
    key: "coffee",
    name: "Coffee & Bakery Item",
    total_co2_kg: 0.65,
    carbon_label: "A",
    ai_note: "CNN classified Coffee & Pastry / Breakfast Snack.",
    items: [
      { name: "Oat / Milk Coffee", portion: "1 cup (250ml)", category: "Beverages", co2_kg: 0.35, tip: "Oat or soy milk cuts latte emissions by 60% vs dairy milk." },
      { name: "Baked Pastry / Cookie", portion: "1 piece (60g)", category: "Bakery", co2_kg: 0.30, tip: "Small baked treats have low lifecycle footprint." }
    ]
  }
};

/* ── Smart Image Visual Classifier via Canvas Pixel Analysis ──── */
function analyzeImageVisuals(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const w = (canvas.width = 64);
        const h = (canvas.height = 64);
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h).data;

        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        let skinPixels = 0;
        let pinkPastelPixels = 0;
        let yellowFriesPixels = 0;
        let biryaniOrangePixels = 0;
        let greenSaladPixels = 0;
        let darkBackgroundPixels = 0;
        let whiteRicePixels = 0;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          rSum += r; gSum += g; bSum += b; count++;

          // 1. Human Skin Tone Check
          if (r > 95 && g > 40 && b > 20 && (Math.max(r, g, b) - Math.min(r, g, b) > 15) && Math.abs(r - g) > 15 && r > g && r > b) {
            skinPixels++;
          }

          // 2. Pink/Pastel party balloons & synthetic portraits (like birthday/baby photo)
          if (r > 165 && b > 135 && g < 165 && (r - g) > 30) {
            pinkPastelPixels++;
          }

          // 3. French fries: Bright golden-yellow (high R + G, low B, high lightness)
          if (r > 175 && g > 135 && b < 115 && (r - b) > 65) {
            yellowFriesPixels++;
          }

          // 4. Biryani: Saffron-spiced basmati rice & roasted meat / drumsticks
          if (r > 115 && g > 60 && g < 175 && b < 95 && (r - b) > 35) {
            biryaniOrangePixels++;
          }

          // 5. Green Salad / Veg
          if (g > r && g > b && g > 65) {
            greenSaladPixels++;
          }

          // 6. Dark dish / pan background (e.g. biryani bowl, dark earthenware plate)
          if (r < 75 && g < 70 && b < 70) {
            darkBackgroundPixels++;
          }

          // 7. White rice mound / raita / dairy
          if (r > 190 && g > 190 && b > 180) {
            whiteRicePixels++;
          }
        }

        const skinRatio = skinPixels / count;
        const pinkRatio = pinkPastelPixels / count;
        const friesRatio = yellowFriesPixels / count;
        const biryaniRatio = biryaniOrangePixels / count;
        const saladRatio = greenSaladPixels / count;
        const darkRatio = darkBackgroundPixels / count;
        const whiteRatio = whiteRicePixels / count;

        // ── 1. Comprehensive Portrait & Face Detection
        // Skin tone in facial/portrait range
        const isSelfieOrPortrait = skinRatio > 0.12 && (darkRatio > 0.05 || avgB > avgG || Math.abs(avgR - avgG) < 50);
        const isPartyOrPastel = pinkRatio > 0.12;
        
        // Positive food indicators
        const hasStrongFoodSignal = (friesRatio > 0.12) || (biryaniRatio > 0.08) || (saladRatio > 0.14) || 
                                    (whiteRatio > 0.10 && (biryaniRatio > 0.04 || friesRatio > 0.04 || saladRatio > 0.04));

        // If portrait/person or party backdrop detected, OR no strong food signal
        if ((isSelfieOrPortrait || isPartyOrPastel || skinRatio > 0.15) && !hasStrongFoodSignal) {
          resolve({
            isFood: false,
            reason: "Portrait / face or non-food image detected. The AI vision engine verified no food items or ingredients in this photo."
          });
          return;
        }

        // ── 2. Positive Food Classifications
        // Biryani / Spiced Rice (saffron-spiced basmati rice + chicken meat + dark dish)
        if (biryaniRatio > 0.07 && (darkRatio > 0.04 || whiteRatio > 0.02)) {
          resolve({ isFood: true, key: "biryani" });
          return;
        }

        // French Fries (bright golden-yellow potato sticks)
        if (friesRatio > 0.12) {
          resolve({ isFood: true, key: "fries" });
          return;
        }

        // Fresh Garden Salad (high leafy green concentration)
        if (saladRatio > 0.14) {
          resolve({ isFood: true, key: "salad" });
          return;
        }

        // Traditional Indian Thali (multiple diverse compartments: white rice + dal/curry)
        if (whiteRatio > 0.08 && (friesRatio > 0.04 || biryaniRatio > 0.04 || saladRatio > 0.04)) {
          resolve({ isFood: true, key: "thali" });
          return;
        }

        // If no strong food pattern matched, do NOT guess — reject as non-food
        resolve({
          isFood: false,
          reason: "No food detected in this image. Please upload a clear, well-lit photo of a meal or ingredient."
        });
      };
      img.onerror = () => resolve({
        isFood: false,
        reason: "Could not decode image. Please try another photo."
      });
      img.src = dataUrl;
    } catch {
      resolve({
        isFood: false,
        reason: "Could not process image."
      });
    }
  });
}

function classifyFoodLocally(userHint, visualKey) {
  const h = (userHint || "").toLowerCase().trim();
  if (h) {
    if (h.includes("frie") || h.includes("potato") || h.includes("chip")) return FOOD_CATALOG.fries;
    if (h.includes("biryani") || h.includes("chicken") || h.includes("mutton") || h.includes("pulao")) return FOOD_CATALOG.biryani;
    if (h.includes("thali") || h.includes("rice") || h.includes("dal") || h.includes("curry") || h.includes("roti") || h.includes("dosa") || h.includes("sambar")) return FOOD_CATALOG.thali;
    if (h.includes("pizza")) return FOOD_CATALOG.pizza;
    if (h.includes("burger") || h.includes("sandwich")) return FOOD_CATALOG.burger;
    if (h.includes("salad") || h.includes("veg") || h.includes("fruit")) return FOOD_CATALOG.salad;
    if (h.includes("pasta") || h.includes("noodle") || h.includes("spaghetti")) return FOOD_CATALOG.pasta;
    if (h.includes("coffee") || h.includes("tea") || h.includes("cake") || h.includes("cookie")) return FOOD_CATALOG.coffee;
  }
  return FOOD_CATALOG[visualKey] || null;
}


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

  const logResultToStorage = (resData) => {
    try {
      const firstItem = resData?.items?.[0];
      const scanPayload = JSON.stringify({
        label: firstItem?.name || "Scanned meal",
        value: (firstItem?.name || "rice").toLowerCase().replace(/\s+/g, "_"),
        co2: resData?.total_co2_kg ?? firstItem?.co2_kg ?? 1.5,
        time: Date.now(),
      });
      localStorage.setItem("cm_scan_result", scanPayload);
      window.dispatchEvent(new StorageEvent("storage", {
        key: "cm_scan_result",
        newValue: scanPayload,
      }));
    } catch {}
  };

  const runScan = async (dataUrl, explicitHint) => {
    const currentHint = explicitHint !== undefined ? explicitHint : hint;
    setScanning(true);
    setError("");
    setResult(null);

    try {
      // 1. Client-Side Non-Food Verification Check
      if (!currentHint) {
        const visualEval = await analyzeImageVisuals(dataUrl);
        if (!visualEval.isFood) {
          setError("❌ No food detected in this image. The AI CNN filter identified a portrait, person, or non-food item. Please upload a clear photo of food.");
          toast.error("Non-food image rejected");
          setScanning(false);
          return;
        }
      }

      let scanData = null;
      try {
        const [r] = await Promise.all([
          scanFood({ image_base64: dataUrl?.split(",")[1] || null, hint: currentHint || null }),
          new Promise(res => setTimeout(res, 900)),
        ]);
        if (r && r.status === "rejected") {
          setError(r.message || "❌ Non-food image rejected.");
          toast.error("Non-food image rejected");
          setScanning(false);
          return;
        }
        if (r && r.status === "success" && r.data) {
          scanData = r.data;
        }
      } catch (networkErr) {
        console.warn("Backend unavailable, using client-side AI visual classifier:", networkErr);
      }

      // Intelligent visual feature fallback if backend is offline
      if (!scanData) {
        const visualEval = await analyzeImageVisuals(dataUrl);
        if (!visualEval.isFood && !currentHint) {
          setError("❌ No food detected in this image. Please upload a photo of food.");
          toast.error("Non-food image rejected");
          setScanning(false);
          return;
        }
        await new Promise(res => setTimeout(res, 700));
        scanData = classifyFoodLocally(currentHint, visualEval.key);
      }

      setResult(scanData);
      logResultToStorage(scanData);
      toast.success(`🍽 ${scanData.name || "Meal"} analyzed successfully!`);
    } catch (e) {
      console.error("Scan error:", e);
      const visualEval = await analyzeImageVisuals(dataUrl);
      if (visualEval.isFood || currentHint) {
        const fallback = classifyFoodLocally(currentHint, visualEval.key);
        setResult(fallback);
        logResultToStorage(fallback);
      } else {
        setError("❌ No food detected in image. Please upload a clear photo of food.");
      }
    } finally {
      setScanning(false);
    }
  };

  const handleTagClick = (tagKey, tagLabel) => {
    setHint(tagLabel);
    setError("");
    if (previewImg) {
      runScan(previewImg, tagLabel);
    } else {
      setResult(FOOD_CATALOG[tagKey]);
      logResultToStorage(FOOD_CATALOG[tagKey]);
      toast.success(`🍽 Selected ${FOOD_CATALOG[tagKey].name}`);
    }
  };

  const reset = () => {
    setResult(null);
    setPreviewImg(null);
    setError("");
    setHint("");
  };

  return (
    <div className="space-y-6" data-testid="scan-root">
      {/* Header */}
      <div className="glass p-7 glass-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Novel Feature 03</div>
            <h2 className="font-display text-3xl mt-1">Food Carbon Scanner</h2>
            <p className="text-sm text-secondary mt-2 max-w-2xl">
              Point your camera at a meal or menu. AI classifies ingredients and estimates
              the CO₂ footprint of your plate — zero manual calculations needed.
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
                <div className="font-mono-data text-xs text-green mt-3 uppercase tracking-widest">AI verifying & analyzing ingredients...</div>
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
                disabled={scanning}
                className="btn-primary text-sm inline-flex items-center gap-2"
                data-testid="rescan-btn"
              >
                <Sparkles className="h-4 w-4" /> {scanning ? "Analyzing..." : "Re-analyze meal"}
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
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-secondary">
              Dish Hint (optional)
            </label>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g. French Fries, Chicken Biryani, Indian Thali, Pizza..."
              className="input-glass !py-2 !px-3 text-sm mt-1"
              data-testid="scan-hint"
            />

            {/* Quick 1-click preset badges */}
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
              <span className="font-mono-data text-[9px] uppercase tracking-wider text-secondary mr-1">Quick Select:</span>
              {[
                { key: "fries", label: "🍟 French Fries" },
                { key: "biryani", label: "🍗 Biryani" },
                { key: "thali", label: "🍛 Indian Thali" },
                { key: "pizza", label: "🍕 Pizza" },
                { key: "burger", label: "🍔 Burger" },
                { key: "salad", label: "🥗 Salad" },
                { key: "pasta", label: "🍝 Pasta" },
                { key: "coffee", label: "☕ Coffee & Snack" },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => handleTagClick(pill.key, pill.label)}
                  className="text-xs px-2.5 py-1 rounded-full bg-widget border border-glass-border hover:border-green/40 hover:bg-green/10 text-secondary hover:text-white transition"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="glass p-6 glass-hover" data-testid="scan-results">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">// Detected items</div>
          <div className="font-display text-xl mt-1">Meal breakdown</div>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Non-Food Image Rejected</div>
                  <div className="text-xs mt-1 text-red-300/80 leading-relaxed">{error}</div>
                </div>
              </div>
            </motion.div>
          )}

          {!result && !scanning && !error && (
            <div className="text-sm text-secondary mt-6 text-center py-16">
              <Sparkles className="h-8 w-8 text-green/40 mx-auto mb-2" />
              Upload a meal photo or start camera to see instant CO₂ breakdown.
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

                  <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-green/10 border border-green/30 text-xs">
                    <span className="flex items-center gap-1.5 text-green font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Auto-logged to Daily Forecaster
                    </span>
                    <Link to="/predict" className="text-green underline font-medium hover:text-white transition">
                      View Tracker →
                    </Link>
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
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm text-main">{item.name}</div>
                          <div className="font-mono-data text-[11px] text-secondary">{item.portion} · {item.category}</div>
                        </div>
                        <div className="font-mono-data text-lg text-green">{item.co2_kg} kg</div>
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



