"use client";

import { useEffect, useState } from "react";

const CELL = 88;
const FILL_RATE = 0.022;

type Square = { x: number; y: number; phase: number };

export function GridLayer() {
  const [squares, setSquares] = useState<Square[] | null>(null);

  useEffect(() => {
    const generate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cols = Math.ceil(w / CELL);
      const rows = Math.ceil(h / CELL);
      const out: Square[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < FILL_RATE) {
            out.push({ x: c * CELL, y: r * CELL, phase: Math.random() * 6 });
          }
        }
      }
      setSquares(out);
    };
    generate();
    let resizeTimer: number | undefined;
    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(generate, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (resizeTimer) window.clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--bg-elev-1) 1px, transparent 1px),
            linear-gradient(to bottom, var(--bg-elev-1) 1px, transparent 1px)
          `,
          backgroundSize: `${CELL}px ${CELL}px`,
          opacity: 0.22,
          WebkitMaskImage:
            "radial-gradient(ellipse 95% 95% at 50% 50%, black 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 95% 95% at 50% 50%, black 60%, transparent 100%)",
        }}
      />
      {squares && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
        >
          {squares.map((s, i) => (
            <span
              key={i}
              className="absolute"
              style={{
                left: s.x,
                top: s.y,
                width: CELL,
                height: CELL,
                backgroundColor: "var(--bg-elev-2)",
                opacity: 0.3,
                animation: `squareBreath 7s ease-in-out ${-s.phase}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
