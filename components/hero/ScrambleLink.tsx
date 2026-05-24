"use client";

import { useEffect, useRef, useState, type AnchorHTMLAttributes } from "react";

const SCRAMBLE_CHARS = "·:-=+*#%";
const SCRAMBLE_MS = 240;
const TICK_MS = 28;

function shouldPreserve(ch: string) {
  return ch === " " || ch === "@" || ch === "." || ch === "→" || ch === "-";
}

function scramble(text: string, t: number): string {
  // t in [0,1]; per-char unlock proportional to position
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (shouldPreserve(ch)) {
      out += ch;
      continue;
    }
    const unlock = i / Math.max(1, text.length - 1);
    if (t > unlock) {
      out += ch;
    } else {
      out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }
  }
  return out;
}

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: string };

export function ScrambleLink({ children, onMouseEnter, onMouseLeave, ...rest }: Props) {
  const text = children;
  const [display, setDisplay] = useState(text);
  const intervalRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const stop = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplay(text);
  };

  const start = () => {
    if (reducedRef.current) return;
    if (intervalRef.current !== null) return;
    startRef.current = performance.now();
    intervalRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startRef.current) / SCRAMBLE_MS);
      setDisplay(scramble(text, t));
      if (t >= 1 && intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, TICK_MS);
  };

  return (
    <a
      {...rest}
      onMouseEnter={(e) => {
        start();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        stop();
        onMouseLeave?.(e);
      }}
      onFocus={start}
      onBlur={stop}
    >
      {display}
    </a>
  );
}
