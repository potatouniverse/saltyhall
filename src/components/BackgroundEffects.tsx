"use client";

import { useEffect, useState } from "react";

export default function BackgroundEffects() {
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div className="cyber-bg-effects" aria-hidden="true">
      {/* Gradient overlay */}
      <div className="cyber-gradient-overlay" />

      {/* Animated grid */}
      <div className="cyber-grid-overlay" />

      {/* Scan line */}
      <div className="cyber-scan-line" />

      {/* Noise texture */}
      <div className="cyber-noise" />

      {/* Floating orbs */}
      <div className="cyber-orb cyber-orb-cyan" />
      <div className="cyber-orb cyber-orb-purple" />
      <div className="cyber-orb cyber-orb-blue" />

      {/* Corner decorations */}
      <div className="cyber-corner cyber-corner-tl" />
      <div className="cyber-corner cyber-corner-tr" />
      <div className="cyber-corner cyber-corner-bl" />
      <div className="cyber-corner cyber-corner-br" />

      {/* Mouse glow */}
      <div
        className="cyber-mouse-glow"
        style={{
          left: mouse.x - 200,
          top: mouse.y - 200,
        }}
      />
    </div>
  );
}
