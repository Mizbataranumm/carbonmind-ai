import React from "react";
import { motion } from "framer-motion";

// CSS-based animated Earth orb — no heavy 3D dependency
const AnimatedEarth = ({ size = 360, health = 100 }) => {
  const hue = Math.max(0, Math.min(160, (health / 100) * 160));
  const glow = `rgba(0, ${Math.round(140 + health)}, 178, 0.35)`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} data-testid="animated-earth">
      <div className="earth-rings r3" />
      <div className="earth-rings r2" />
      <div className="earth-rings" />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="earth-orb"
        style={{
          width: size * 0.65,
          height: size * 0.65,
          boxShadow: `0 0 90px ${glow}, inset 0 0 60px rgba(0,255,178,0.12)`,
          filter: `hue-rotate(${hue - 100}deg)`,
        }}
      />
      {/* Orbiting dots */}
      {[0, 120, 240].map((deg) => (
        <motion.div
          key={deg}
          className="absolute"
          style={{ width: size, height: size }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18 + deg / 30, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="absolute h-2 w-2 rounded-full"
            style={{
              top: "0%",
              left: "50%",
              transform: `translate(-50%, -50%)`,
              background: deg === 120 ? "#00D9FF" : "#00FFB2",
              boxShadow: `0 0 16px ${deg === 120 ? "#00D9FF" : "#00FFB2"}`,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default AnimatedEarth;
