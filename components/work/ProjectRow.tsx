"use client";

import { useState, useEffect, useRef } from "react";
import type { Project } from "@/lib/projects";

const DENSITY_UP: Record<string, string> = {
  "▒": "▓",
  "▓": "█",
  "█": "█",
};

export function ProjectRow({
  project,
  isLast,
  visible,
  index,
}: {
  project: Project;
  isLast: boolean;
  visible: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    timerRef.current = setTimeout(() => {
      setPulsing(true);
      timerRef.current = setTimeout(() => setPulsing(false), 300);
    }, index * 120 + 100);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, index]);

  const densityChar =
    pulsing || hovered ? DENSITY_UP[project.density] : project.density;

  return (
    <div
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="section-reveal"
        style={{
          transitionDelay: visible ? `${index * 120}ms` : "0ms",
          opacity: visible ? undefined : 0,
        }}
        data-visible={visible || undefined}
      >
        <div
          className="grid grid-cols-[2ch_1fr_auto] items-baseline gap-x-2 py-3 transition-colors duration-200 sm:grid-cols-[3ch_1fr_auto] sm:gap-x-4 sm:py-4"
          style={{
            backgroundColor: hovered
              ? "var(--bg-elev-1)"
              : "transparent",
          }}
        >
          <span
            className="font-mono text-[14px] text-[var(--fg-muted)] transition-all duration-200"
            aria-hidden
          >
            {densityChar}
          </span>

          <div className="min-w-0">
            <span className="font-mono text-[14px] font-medium text-[var(--fg-strong)]">
              {project.title}
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-muted)]">
              {project.description}
            </p>
          </div>

          <span className="font-mono text-[11px] text-[var(--fg-quiet)] whitespace-nowrap">
            {project.year}
          </span>
        </div>
      </div>

      {!isLast && (
        <div
          className="h-px w-full"
          style={{ backgroundColor: "var(--border)" }}
          aria-hidden
        />
      )}
    </div>
  );
}
