"use client";

import { useRef, useEffect } from "react";
import type { Project } from "@/lib/projects";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useScrambleWalk } from "@/lib/hooks/useScrambleWalk";

const DENSITY_UP: Record<string, string> = { "▒": "▓", "▓": "█", "█": "█" };
const ORBIT_MS = 3500;
const ORBIT_CHAR = "▓";

interface Props {
  project: Project;
  focused: boolean;
  onHover: () => void;
  onLeave: () => void;
  visible: boolean;
  index: number;
}

export function WorkCard({ project, focused, onHover, onLeave, visible, index }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const orbitSpanRef = useRef<HTMLSpanElement>(null);
  const touchLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mouse position stored in ref — no re-render on every mousemove
  const mousePosRef = useRef({ x: 50, y: 50 });
  const reduced = useReducedMotion();
  const titleWalk = useScrambleWalk(project.title);

  // Single rAF loop: drives both orbit AND spotlight via direct DOM writes.
  // No React state updates inside the loop → zero re-renders per frame.
  useEffect(() => {
    if (!focused || reduced) {
      // Reset background when unfocused
      if (innerRef.current) innerRef.current.style.background = "transparent";
      if (orbitSpanRef.current) orbitSpanRef.current.style.opacity = "0";
      return;
    }
    if (typeof window !== "undefined" && "ontouchstart" in window) {
      // Touch: just show the elevated background, no orbit
      if (innerRef.current) innerRef.current.style.background = "var(--bg-elev-1)";
      return;
    }

    let raf: number;
    const start = performance.now();

    const tick = () => {
      const card = cardRef.current;
      const inner = innerRef.current;
      const orbit = orbitSpanRef.current;
      if (!card || !inner || !orbit) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // Orbit character — perimeter walk
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const perimeter = 2 * (w + h);
      const pos = (((performance.now() - start) % ORBIT_MS) / ORBIT_MS) * perimeter;

      let ox = 0, oy = 0;
      if (pos < w) { ox = pos; oy = 0; }
      else if (pos < w + h) { ox = w; oy = pos - w; }
      else if (pos < 2 * w + h) { ox = w - (pos - w - h); oy = h; }
      else { ox = 0; oy = h - (pos - 2 * w - h); }

      orbit.style.left = `${ox}px`;
      orbit.style.top = `${oy}px`;
      orbit.style.opacity = "1";

      // Spotlight gradient from mouse position (ref, no re-render)
      const { x, y } = mousePosRef.current;
      inner.style.background = `radial-gradient(circle 120px at ${x}% ${y}%, rgba(200,198,194,0.06) 0%, transparent 60%), var(--bg-elev-1)`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    const inner = innerRef.current;
    const orbit = orbitSpanRef.current;
    return () => {
      cancelAnimationFrame(raf);
      if (inner) inner.style.background = "transparent";
      if (orbit) orbit.style.opacity = "0";
    };
  }, [focused, reduced]);

  // Cleanup touch timer on unmount
  useEffect(() => {
    return () => {
      if (touchLeaveTimer.current) clearTimeout(touchLeaveTimer.current);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Write to ref only — no setState, no re-render
    mousePosRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleTouchStart = () => {
    if (touchLeaveTimer.current) {
      clearTimeout(touchLeaveTimer.current);
      touchLeaveTimer.current = null;
    }
    onHover();
  };

  const handleTouchEnd = () => {
    touchLeaveTimer.current = setTimeout(() => {
      onLeave();
      touchLeaveTimer.current = null;
    }, 2000);
  };

  const dimmed = !focused && visible;

  return (
    <div
      ref={cardRef}
      className="relative"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity 300ms ease ${index * 120}ms`,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={innerRef}
        className="relative overflow-hidden py-4 px-3 sm:py-5 sm:px-4"
        style={{ transition: "background 200ms ease" }}
      >
        {/* Orbit character — positioned absolutely, driven by rAF */}
        <span
          ref={orbitSpanRef}
          className="font-mono text-[9px] text-[var(--fg-quietest)]"
          style={{
            position: "absolute",
            opacity: 0,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
          aria-hidden
        >
          {ORBIT_CHAR}
        </span>

        <div className="grid grid-cols-[2ch_1fr_auto] items-baseline gap-x-2 sm:grid-cols-[3ch_1fr_auto] sm:gap-x-4">
          <span
            className="font-mono text-[14px] transition-colors duration-300"
            style={{
              color: focused
                ? "var(--fg-muted)"
                : dimmed ? "var(--fg-quietest)" : "var(--fg-muted)",
            }}
            aria-hidden
          >
            {focused ? (DENSITY_UP[project.density] ?? project.density) : project.density}
          </span>

          <div className="min-w-0">
            <span
              className="font-mono text-[14px] font-medium transition-colors duration-300"
              style={{ color: dimmed ? "var(--fg-quietest)" : "var(--fg-strong)" }}
              onMouseMove={titleWalk.onMouseMove}
            >
              {titleWalk.display}
            </span>
            <p
              className="mt-1 font-mono text-[12px] leading-[1.5] transition-colors duration-300"
              style={{ color: dimmed ? "var(--fg-quietest)" : "var(--fg-muted)" }}
            >
              {project.description}
            </p>
          </div>

          <span
            className="font-mono text-[11px] whitespace-nowrap transition-colors duration-300"
            style={{ color: dimmed ? "var(--fg-quietest)" : "var(--fg-quiet)" }}
          >
            {project.year}
          </span>
        </div>
      </div>
    </div>
  );
}
