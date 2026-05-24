// components/shared/BorderBeam.tsx

"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const LOOP_MS = 6000;
const CHAR = "░";

interface Props {
  className?: string;
}

export function BorderBeam({ className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const container = containerRef.current;
    const char = charRef.current;
    if (!container || !char) return;

    let raf: number;
    const start = performance.now();

    let w = container.offsetWidth;
    const ro = new ResizeObserver(() => { w = container.offsetWidth; });
    ro.observe(container);

    const tick = () => {
      if (w === 0) { raf = requestAnimationFrame(tick); return; }
      const t = ((performance.now() - start) % LOOP_MS) / LOOP_MS;
      char.style.transform = `translateX(${t * w}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced]);

  return (
    <div
      ref={containerRef}
      className={`relative h-px w-full overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--border)" }}
      aria-hidden
    >
      {!reduced && (
        <span
          ref={charRef}
          className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--fg-quietest)]"
          style={{ willChange: "transform" }}
        >
          {CHAR}
        </span>
      )}
    </div>
  );
}
