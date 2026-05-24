"use client";

import { useEffect, useRef, useState, type AnchorHTMLAttributes } from "react";
import { scrambleText } from "@/lib/ascii/scramble";

const SCRAMBLE_MS = 240;
const TICK_MS = 28;

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: string };

export function ScrambleLink({
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: Props) {
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
      const t = Math.min(
        1,
        (performance.now() - startRef.current) / SCRAMBLE_MS,
      );
      setDisplay(scrambleText(text, t));
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
