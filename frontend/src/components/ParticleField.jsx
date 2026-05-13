import React, { useMemo } from "react";

// Lightweight CSS particle field — no canvas, GPU-friendly
const ParticleField = ({ count = 28, color = "green" }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const dx = (Math.random() - 0.5) * 240;
      const dy = -200 - Math.random() * 320;
      const dur = 6 + Math.random() * 10;
      const delay = Math.random() * 6;
      const cls = Math.random() > 0.5 && color === "mixed" ? "particle cyan" : (color === "cyan" ? "particle cyan" : "particle");
      return { i, left, top, dx, dy, dur, delay, cls };
    });
  }, [count, color]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="particle-field">
      {particles.map(p => (
        <span
          key={p.i}
          className={p.cls}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--dur": `${p.dur}s`,
            "--delay": `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default ParticleField;
