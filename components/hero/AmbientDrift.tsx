"use client";

import { useEffect, useState } from "react";

const RAMP = ["·", "░", "▒", "▓"] as const;

type Particle = {
  id: number;
  ch: string;
  x: number; // %
  y: number; // %
  size: number; // px
  duration: number; // s
  delay: number; // s
  opacity: number;
  drift: number; // px vertical drift
};

const COUNT = 36;

function build(): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < COUNT; i++) {
    out.push({
      id: i,
      ch: RAMP[Math.floor(Math.random() * RAMP.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 10 + Math.random() * 6,
      duration: 14 + Math.random() * 18,
      delay: -Math.random() * 20,
      opacity: 0.05 + Math.random() * 0.18,
      drift: -40 - Math.random() * 80,
    });
  }
  return out;
}

export function AmbientDrift() {
  const [particles, setParticles] = useState<Particle[] | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = requestAnimationFrame(() => {
      setReduced(mq.matches);
      setParticles(build());
    });
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  if (!particles || reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      style={{
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 75% at 50% 50%, black 35%, transparent 90%)",
        maskImage:
          "radial-gradient(ellipse 80% 75% at 50% 50%, black 35%, transparent 90%)",
      }}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute font-mono text-[var(--fg-quietest)]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animation: `drift ${p.duration}s linear ${p.delay}s infinite`,
            // CSS variable for drift distance
            ["--drift" as never]: `${p.drift}px`,
          }}
        >
          {p.ch}
        </span>
      ))}
    </div>
  );
}
