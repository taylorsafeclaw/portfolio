"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCRAMBLE_CHARS } from "@/lib/ascii/ramp";
import { scrambleText } from "@/lib/ascii/scramble";

const WALK_MS = 1000; // out-and-back ramp walk per character (§6b)
const FOCUS_MS = 240; // keyboard focus keeps the whole-label scramble

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Char-precision hover scramble (§6b): only the characters under and
 * adjacent to the cursor (±1 cell) walk the scramble alphabet out and back
 * on an easeOutQuint triangle wave. Monospace makes hit-testing trivial.
 * Keyboard focus (no cursor to localize) scrambles the whole label.
 */
export function useScrambleWalk(text: string) {
  const [display, setDisplay] = useState(text);
  const startsRef = useRef<Float64Array>(new Float64Array(text.length));
  const rafRef = useRef<number | null>(null);
  const focusStartRef = useRef(0);
  const reducedRef = useRef(false);
  // Stable indirection so the recursive rAF always calls the latest frame.
  const frameRef = useRef<() => void>(() => {});
  const textRef = useRef(text);

  const frame = useCallback(() => {
    const now = performance.now();
    const t = textRef.current;
    const starts = startsRef.current;
    let active = false;
    let out = "";

    if (focusStartRef.current > 0) {
      const fp = Math.min(1, (now - focusStartRef.current) / FOCUS_MS);
      out = scrambleText(t, fp);
      if (fp < 1) active = true;
      else focusStartRef.current = 0;
    } else {
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        const s = starts[i];
        if (s === 0 || ch === " ") {
          out += ch;
          continue;
        }
        const p = (now - s) / WALK_MS;
        if (p >= 1) {
          starts[i] = 0;
          out += ch;
          continue;
        }
        active = true;
        const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
        const depth = easeOutQuint(tri);
        out +=
          depth < 0.08
            ? ch
            : SCRAMBLE_CHARS[Math.min(SCRAMBLE_CHARS.length - 1, Math.floor(depth * SCRAMBLE_CHARS.length))];
      }
    }

    setDisplay(active ? out : t);
    rafRef.current = active ? requestAnimationFrame(frameRef.current) : null;
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    frameRef.current = frame;
  }, [frame]);

  // Reset to the new label whenever `text` changes; the single inactive frame
  // repaints `display` without a direct state write in the effect body.
  useEffect(() => {
    textRef.current = text;
    startsRef.current = new Float64Array(text.length);
    focusStartRef.current = 0;
    ensureLoop();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [text, ensureLoop]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const t = textRef.current;
      if (reducedRef.current || t.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const idx = Math.floor(((e.clientX - rect.left) / rect.width) * t.length);
      const now = performance.now();
      const starts = startsRef.current;
      for (let j = idx - 1; j <= idx + 1; j++) {
        if (j < 0 || j >= t.length || t[j] === " ") continue;
        // re-arm only chars past their outbound half — keeps the wave smooth
        if (starts[j] === 0 || now - starts[j] > WALK_MS / 2) starts[j] = now;
      }
      ensureLoop();
    },
    [ensureLoop],
  );

  const onFocus = useCallback(() => {
    if (reducedRef.current) return;
    focusStartRef.current = performance.now();
    ensureLoop();
  }, [ensureLoop]);

  const onBlur = useCallback(() => {
    focusStartRef.current = 0;
  }, []);

  return { display, onMouseMove, onFocus, onBlur };
}
