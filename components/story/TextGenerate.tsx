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
  const [flashChar, setFlashChar] = useState<string>(RAMP_CHARS[0]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allWords: { word: string; emphasis: boolean }[] = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      allWords.push({ word: w, emphasis: seg.emphasis ?? false });
    }
  }
  const totalWords = allWords.length;

  useEffect(() => {
    if (reduced) {
      // Use a timer callback to avoid synchronous setState in effect body.
      const id = setTimeout(() => setRevealedWords(totalWords), 0);
      return () => clearTimeout(id);
    }
    if (!inView) return;

    let current = 0;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    const reveal = () => {
      if (current >= totalWords) return;
      const idx = current;
      current++;

      // Flash the ramp char first (word still hidden at idx)
      setFlashChar(RAMP_CHARS[Math.floor(Math.random() * RAMP_CHARS.length)]);
      setFlashIndex(idx);

      flashTimer = setTimeout(() => {
        // Now reveal the word and clear flash
        setRevealedWords(idx + 1);
        setFlashIndex(-1);
        // Schedule next word after reveal
        timerRef.current = setTimeout(reveal, WORD_DELAY_MS);
      }, RAMP_FLASH_MS);
    };

    timerRef.current = setTimeout(reveal, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (flashTimer) clearTimeout(flashTimer);
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
                opacity: visible || flashing ? 1 : 0,
                transition: "opacity 100ms ease",
              }}
              className={entry.emphasis ? "font-medium text-[var(--fg-peak)]" : ""}
            >
              {flashing ? flashChar : entry.word}
            </span>
          </span>
        );
      })}
    </p>
  );
}
