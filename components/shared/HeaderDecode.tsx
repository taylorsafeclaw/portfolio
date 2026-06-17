// components/shared/HeaderDecode.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/hooks/useInView";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { scrambleText } from "@/lib/ascii/scramble";
import { RESOLVE_CHAR_MS } from "@/lib/ascii/ramp";

const DECODE_MS = RESOLVE_CHAR_MS;
const TICK_MS = 28;

interface Props {
  text: string;
  className?: string;
  as?: "h2" | "span" | "div";
}

export function HeaderDecode({ text, className = "", as: Tag = "h2" }: Props) {
  const { ref, inView } = useInView<HTMLHeadingElement>({ threshold: 0.3 });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const hasDecoded = useRef(false);

  useEffect(() => {
    if (!inView || hasDecoded.current || reduced) return;
    hasDecoded.current = true;

    const start = performance.now();
    let id: ReturnType<typeof setTimeout>;

    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / DECODE_MS);
      setDisplay(scrambleText(text, t));
      if (t < 1) {
        id = setTimeout(tick, TICK_MS);
      }
    };
    tick();

    return () => clearTimeout(id);
  }, [inView, text, reduced]);

  return (
    <Tag
      ref={ref as React.RefObject<HTMLHeadingElement>}
      aria-label={text}
      className={`font-[var(--font-display)] text-[13px] font-normal tracking-[0.04em] text-[var(--fg-strong)] lowercase ${className}`}
    >
      {display}
    </Tag>
  );
}
