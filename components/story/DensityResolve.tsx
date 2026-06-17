"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "@/lib/hooks/useInView";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { RESOLVE_CHAR_MS, RESOLVE_SWEEP_MS } from "@/lib/ascii/ramp";

const DENSITY_RAMP = ["8", "5", "=", ":"];
const RESOLVED = DENSITY_RAMP.length;

interface TextSegment {
  text: string;
  emphasis?: boolean;
}

interface Props {
  segments: TextSegment[];
  className?: string;
  stagger?: number;
  resolveDuration?: number;
}

export function DensityResolve({
  segments,
  className = "",
  stagger = RESOLVE_SWEEP_MS,
  resolveDuration = RESOLVE_CHAR_MS,
}: Props) {
  const { ref, inView } = useInView<HTMLParagraphElement>({ threshold: 0.3 });
  const reduced = useReducedMotion();
  const hasStarted = useRef(false);

  const allWords = useMemo(() => {
    const words: { word: string; emphasis: boolean }[] = [];
    for (const seg of segments) {
      for (const w of seg.text.split(/\s+/).filter(Boolean)) {
        words.push({ word: w, emphasis: seg.emphasis ?? false });
      }
    }
    return words;
  }, [segments]);

  const totalWords = allWords.length;

  const [wordStates, setWordStates] = useState<number[]>(() =>
    reduced ? new Array(totalWords).fill(RESOLVED) : new Array(totalWords).fill(0)
  );

  const stepDuration = resolveDuration / DENSITY_RAMP.length;

  useEffect(() => {
    if (reduced || !inView || hasStarted.current) return;
    hasStarted.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < totalWords; i++) {
      for (let step = 1; step <= RESOLVED; step++) {
        const delay = i * stagger + step * stepDuration;
        timers.push(
          setTimeout(() => {
            setWordStates((prev) => {
              const next = [...prev];
              next[i] = step;
              return next;
            });
          }, delay)
        );
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [inView, totalWords, stagger, stepDuration, reduced]);

  return (
    <p ref={ref} className={className}>
      {allWords.map((entry, i) => {
        const state = wordStates[i];
        const resolved = state === RESOLVED;
        return (
          <span key={i}>
            {i > 0 && " "}
            <span
              className={
                resolved && entry.emphasis
                  ? "font-medium text-[var(--fg-peak)]"
                  : undefined
              }
            >
              {resolved
                ? entry.word
                : DENSITY_RAMP[state].repeat(entry.word.length)}
            </span>
          </span>
        );
      })}
    </p>
  );
}
