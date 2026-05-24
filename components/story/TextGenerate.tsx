// components/story/TextGenerate.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/hooks/useInView";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const WORD_DELAY_MS = 80;
const RAMP_FLASH_MS = 120;
const RAMP_CHARS = ["░", "▒"];

interface TextSegment {
  text: string;
  emphasis?: boolean;
}

interface Props {
  segments: TextSegment[];
  className?: string;
}

export function TextGenerate({ segments, className = "" }: Props) {
  const { ref, inView } = useInView<HTMLParagraphElement>({ threshold: 0.3 });
  const reduced = useReducedMotion();
  const [revealedWords, setRevealedWords] = useState<number>(0);
  const [flashIndex, setFlashIndex] = useState<number>(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allWords: { word: string; emphasis: boolean }[] = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      allWords.push({ word: w, emphasis: seg.emphasis ?? false });
    }
  }
  const totalWords = allWords.length;

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) setRevealedWords(totalWords);
      return;
    }

    let current = 0;
    const reveal = () => {
      if (current >= totalWords) return;
      setFlashIndex(current);
      setTimeout(() => setFlashIndex(-1), RAMP_FLASH_MS);
      current++;
      setRevealedWords(current);
      timerRef.current = setTimeout(reveal, WORD_DELAY_MS);
    };
    timerRef.current = setTimeout(reveal, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inView, totalWords, reduced]);

  return (
    <p ref={ref} className={className}>
      {allWords.map((entry, i) => {
        const visible = i < revealedWords;
        const flashing = i === flashIndex;
        return (
          <span key={i}>
            {i > 0 && " "}
            <span
              style={{
                opacity: visible ? 1 : 0,
                transition: "opacity 100ms ease",
              }}
              className={entry.emphasis ? "font-medium text-[var(--fg-peak)]" : ""}
            >
              {flashing ? RAMP_CHARS[Math.floor(Math.random() * RAMP_CHARS.length)] : entry.word}
            </span>
          </span>
        );
      })}
    </p>
  );
}
