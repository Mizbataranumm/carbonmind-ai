import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, MapPin, Play, Square, Check, X, Compass, AlertCircle } from "lucide-react";
import { calculateDistanceKm, requestCurrentLocation } from "@/lib/geoTracker";

export default function GpsCommuteModal({ open, onClose, onDistanceDetected }) {
  const [status, setStatus] = useState("idle"); // "idle" | "tracking" | "finished" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [startCoords, setStartCoords] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [totalKm, setTotalKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const prevCoordsRef = useRef(null);

  // Clear tracking on close
  useEffect(() => {
    if (!open) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setStatus("idle");
      setTotalKm(0);
      setElapsedSeconds(0);
      setErrorMessage("");
    }
  }, [open]);

  // Start live GPS tracking (triggers browser location permission prompt!)
  const startTracking = async () => {
    setErrorMessage("");
    setStatus("requesting");
    try {
      const initial = await requestCurrentLocation();
      setStartCoords(initial);
      setCurrentCoords(initial);
      prevCoordsRef.current = initial;
      setStatus("tracking");
      setTotalKm(0);
      setElapsedSeconds(0);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);

      // Watch position continuously as user moves
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const next = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            };
            setCurrentCoords(next);
            if (prevCoordsRef.current) {
              const delta = calculateDistanceKm(
                prevCoordsRef.current.latitude,
                prevCoordsRef.current.longitude,
                next.latitude,
                next.longitude
              );
              // Only accumulate if moved more than 15 meters (filter GPS jitter)
              if (delta >= 0.015) {
                setTotalKm((prev) => +(prev + delta).toFixed(2));
                prevCoordsRef.current = next;
              }
            } else {
              prevCoordsRef.current = next;
            }
          },
          (err) => {
            console.error("WatchPosition error:", err);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
        );
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Location access was denied or unavailable.");
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("finished");
  };

  const applyDistance = () => {
    const finalKm = totalKm > 0 ? totalKm : 1.0;
    onDistanceDetected(finalKm);
    onClose();
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md p-6 rounded-2xl glass border border-glass-border relative text-main overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-secondary hover:text-main transition p-1"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Navigation className="h-5 w-5 text-green animate-pulse" />
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-green">
            // Proactive GPS Commute Tracker
          </div>
        </div>

        <h3 className="font-display text-2xl font-bold">Auto-Detect Travel Distance</h3>
        <p className="text-xs text-secondary mt-1">
          Uses your device&apos;s real GPS location to automatically measure distance in km as you move.
        </p>

        {/* Status display */}
        <div className="mt-5 p-4 rounded-xl bg-widget border border-glass-border flex flex-col items-center justify-center text-center">
          {status === "idle" && (
            <div className="space-y-3 py-4">
              <div className="h-16 w-16 rounded-full bg-green/10 border border-green/30 flex items-center justify-center mx-auto text-green">
                <Compass className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium">Ready to track your commute</p>
                <p className="text-xs text-secondary mt-1 max-w-xs mx-auto">
                  Clicking Start will prompt your browser for location permission and begin measuring real-time distance.
                </p>
              </div>
            </div>
          )}

          {status === "requesting" && (
            <div className="py-6 space-y-3">
              <div className="h-10 w-10 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-green">Requesting location access...</p>
              <p className="text-xs text-secondary">Please click &quot;Allow&quot; on your browser&apos;s location prompt.</p>
            </div>
          )}

          {status === "tracking" && (
            <div className="space-y-3 py-2 w-full">
              <div className="flex items-center justify-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green animate-ping" />
                <span className="font-mono-data text-xs text-green font-semibold">GPS ACTIVE & RECORDING</span>
              </div>
              <div className="font-mono-data text-5xl font-bold text-green tracking-tight">
                {totalKm.toFixed(2)} <span className="text-lg text-secondary font-normal">km</span>
              </div>
              <div className="flex justify-center gap-6 text-xs font-mono-data text-secondary">
                <div>Elapsed: <span className="text-main font-semibold">{formatTime(elapsedSeconds)}</span></div>
                {currentCoords && (
                  <div>Accuracy: <span className="text-main font-semibold">±{Math.round(currentCoords.accuracy || 10)}m</span></div>
                )}
              </div>
              {currentCoords && (
                <div className="text-[10px] font-mono-data text-secondary/60">
                  Lat: {currentCoords.latitude.toFixed(4)}, Lon: {currentCoords.longitude.toFixed(4)}
                </div>
              )}
            </div>
          )}

          {status === "finished" && (
            <div className="space-y-3 py-3 w-full">
              <div className="h-12 w-12 rounded-full bg-green/20 border border-green/40 flex items-center justify-center mx-auto text-green">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-mono-data text-secondary">Trip Finished</p>
                <div className="font-mono-data text-4xl font-bold text-green mt-1">
                  {totalKm > 0 ? totalKm.toFixed(2) : "1.00"} <span className="text-base text-secondary">km</span>
                </div>
                <p className="text-xs text-secondary mt-1">Ready to insert into your travel activity row.</p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-2 py-4 text-center">
              <AlertCircle className="h-10 w-10 text-[#FF6B6B] mx-auto" />
              <p className="text-sm font-medium text-[#FF6B6B]">Location Permission Required</p>
              <p className="text-xs text-secondary max-w-xs mx-auto leading-relaxed">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="mt-5 space-y-2">
          {status === "idle" && (
            <button
              onClick={startTracking}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-3 font-medium text-sm"
              data-testid="start-gps-btn"
            >
              <Play className="h-4 w-4" /> Start GPS Trip Tracking
            </button>
          )}

          {status === "tracking" && (
            <button
              onClick={stopTracking}
              className="w-full inline-flex items-center justify-center gap-2 !py-3 rounded-xl bg-[#FF4D4D] text-white hover:bg-[#FF3333] transition font-medium text-sm"
              data-testid="stop-gps-btn"
            >
              <Square className="h-4 w-4" /> Stop Trip & Record Distance
            </button>
          )}

          {status === "finished" && (
            <button
              onClick={applyDistance}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-3 font-medium text-sm"
              data-testid="apply-gps-btn"
            >
              <Check className="h-4 w-4" /> Apply {totalKm > 0 ? totalKm.toFixed(2) : "1.0"} km to Travel
            </button>
          )}

          {status === "error" && (
            <button
              onClick={startTracking}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-3 font-medium text-sm"
            >
              Retry Location Request
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
