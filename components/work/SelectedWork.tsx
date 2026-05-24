"use client";

import { useEffect, useRef, useState } from "react";
import { projects } from "@/lib/projects";
import { ProjectRow } from "@/components/work/ProjectRow";
import { scrambleText } from "@/lib/ascii/scramble";

const HEADER_TEXT = "selected work";
const SCRAMBLE_DURATION = 400;
const SCRAMBLE_CHARS = "·░▒▓█-:=+";

export function SelectedWork() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [headerDisplay, setHeaderDisplay] = useState(HEADER_TEXT);
  const scrambleStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();

          if (!reduced) {
            scrambleStartRef.current = performance.now();
            const tick = () => {
              const elapsed =
                performance.now() - scrambleStartRef.current!;
              const progress = Math.min(
                1,
                elapsed / SCRAMBLE_DURATION,
              );
              setHeaderDisplay(
                scrambleText(
                  HEADER_TEXT,
                  progress,
                  SCRAMBLE_CHARS,
                ),
              );
              if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
              }
            };
            rafRef.current = requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="selected-work"
      className="relative z-10 mx-auto w-full max-w-[72ch] px-6 pt-16 pb-12 sm:px-10 sm:pt-24 sm:pb-16"
    >
      <h2 className="mb-8 font-[var(--font-display)] text-[13px] font-normal tracking-[0.04em] text-[var(--fg-strong)] lowercase">
        {headerDisplay}
      </h2>

      <div className="flex flex-col">
        {projects.map((project, i) => (
          <ProjectRow
            key={project.title}
            project={project}
            isLast={i === projects.length - 1}
            visible={visible}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
