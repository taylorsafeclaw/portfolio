"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { getSnapshot as getScrollSnapshot } from "@/lib/scroll-store";

const WORDMARK_RAMP = ["·", "░", "▒", "▓", "█"] as const;
type Ramp = (typeof WORDMARK_RAMP)[number];

const LETTERS: Record<string, string[]> = {
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  ", "  █  "],
  A: [" ███ ", "█   █", "█   █", "█████", "█   █", "█   █"],
  Y: ["█   █", "█   █", " █ █ ", "  █  ", "  █  ", "  █  "],
  L: ["█    ", "█    ", "█    ", "█    ", "█    ", "█████"],
  O: [" ███ ", "█   █", "█   █", "█   █", "█   █", " ███ "],
  R: ["████ ", "█   █", "█   █", "████ ", "█  █ ", "█   █"],
};

const WORD = "TAYLOR";

function buildWordRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 6; r++) {
    let line = "";
    WORD.split("").forEach((ch, i) => {
      line += LETTERS[ch][r];
      if (i < WORD.length - 1) line += " ";
    });
    rows.push(line);
  }
  return rows;
}

const RESOLVED_ROWS = buildWordRows();

const APPEAR_START = 2800;
const APPEAR_DURATION = 1000;
const SET_START = APPEAR_START + APPEAR_DURATION + 100;
const SET_DURATION = 900;
const RESOLVE_DONE = SET_START + SET_DURATION;

const WAVE_INITIAL_DELAY = 2500;
const WAVE_INTERVAL = 5200;
const WAVE_DURATION = 1700;
const WAVE_BAND = 5;
const WAVE_SKEW = 0.7;

type Cell = {
  ch: Ramp | " ";
  isFilled: boolean;
  progress: number;
  flicker: number;
};

function rampForProgress(p: number): Ramp {
  const idx = Math.min(WORDMARK_RAMP.length - 1, 1 + Math.floor(p * (WORDMARK_RAMP.length - 1)));
  return WORDMARK_RAMP[idx];
}

function computeCenter(
  filled: Array<[number, number]>,
): [number, number] {
  let minR = Infinity,
    maxR = -Infinity,
    minC = Infinity,
    maxC = -Infinity;
  for (const [r, c] of filled) {
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return [(minR + maxR) / 2, (minC + maxC) / 2];
}

function pseudoRandom(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Pre-computed per-cell dissolve thresholds: edges spark out first, center holds longest
const DISSOLVE_THRESHOLDS: Map<string, number> = (() => {
  const filled: Array<[number, number]> = [];
  RESOLVED_ROWS.forEach((row, r) =>
    row.split("").forEach((c, col) => {
      if (c !== " ") filled.push([r, col]);
    }),
  );
  const [cr, cc] = computeCenter(filled);
  let maxDist = 0;
  for (const [r, c] of filled) {
    const d = Math.sqrt((r - cr) ** 2 + ((c - cc) * 0.25) ** 2);
    if (d > maxDist) maxDist = d;
  }
  const m = new Map<string, number>();
  for (const [r, c] of filled) {
    const d = Math.sqrt((r - cr) ** 2 + ((c - cc) * 0.25) ** 2);
    const norm = d / Math.max(1, maxDist);
    const base = 0.04 + (1 - norm) * 0.65;
    const jitter = (pseudoRandom(r, c) - 0.5) * 0.22;
    m.set(`${r},${c}`, Math.max(0.04, Math.min(0.80, base + jitter)));
  }
  return m;
})();

export function Wordmark() {
  const [grid, setGrid] = useState<Cell[][]>(() =>
    RESOLVED_ROWS.map((row) =>
      row.split("").map((c) => ({
        ch: " " as Ramp | " ",
        isFilled: c !== " ",
        progress: 0,
        flicker: 0,
      })),
    ),
  );
  const [glow, setGlow] = useState(0);

  const reduced = useReducedMotion();
  const rafRef = useRef<number | null>(null);
  const tabHidden = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const filled: Array<[number, number]> = [];
    RESOLVED_ROWS.forEach((row, r) =>
      row.split("").forEach((c, col) => {
        if (c !== " ") filled.push([r, col]);
      }),
    );

    if (reduced) {
      const id = requestAnimationFrame(() => {
        setGrid(
          RESOLVED_ROWS.map((row) =>
            row.split("").map((c) => ({
              ch: (c === " " ? " " : "█") as Ramp | " ",
              isFilled: c !== " ",
              progress: 1,
              flicker: 0,
            })),
          ),
        );
      });
      return () => cancelAnimationFrame(id);
    }

    // Crystal growth: Manhattan distance from center
    const [centerR, centerC] = computeCenter(filled);
    const distances = new Map<string, number>();
    let maxDist = 0;
    for (const [r, c] of filled) {
      const d = Math.abs(r - centerR) + Math.abs(c - centerC);
      distances.set(`${r},${c}`, d);
      if (d > maxDist) maxDist = d;
    }

    const appearDelays = new Map<string, number>();
    const setDelays = new Map<string, number>();
    const appearWindow = APPEAR_DURATION * 0.7;
    const setWindow = SET_DURATION * 0.65;

    for (const [r, c] of filled) {
      const key = `${r},${c}`;
      const normDist = (distances.get(key) ?? 0) / Math.max(1, maxDist);
      appearDelays.set(key, normDist * appearWindow);
      setDelays.set(key, normDist * setWindow);
    }

    const onVisibility = () => {
      tabHidden.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const start = performance.now();
    let raf = 0;
    const totalCols = RESOLVED_ROWS[0].length;
    const totalRows = RESOLVED_ROWS.length;
    const waveSpan = totalCols + totalRows * WAVE_SKEW + WAVE_BAND * 2;

    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

    const tick = (now: number) => {
      const elapsed = now - start;
      const dp = getScrollSnapshot().heroDissolve;

      setGrid((prev) => {
        const next = prev.map((row) => row.slice());

        for (let r = 0; r < next.length; r++) {
          for (let c = 0; c < next[r].length; c++) {
            const cell = next[r][c];
            if (!cell.isFilled) continue;
            const key = `${r},${c}`;

            if (elapsed < APPEAR_START) {
              next[r][c] = { ch: " ", isFilled: true, progress: 0, flicker: 0 };
              continue;
            }

            const aDelay = appearDelays.get(key) ?? 0;
            const aLocal = elapsed - APPEAR_START - aDelay;
            const aProgress = Math.max(0, Math.min(1, aLocal / 300));

            const sDelay = setDelays.get(key) ?? 0;
            const sLocal = elapsed - SET_START - sDelay;
            const sProgress = Math.max(0, Math.min(1, sLocal / 480));

            // Wave influence (suppress during dissolve)
            let waveBoost = 0;
            const sinceFirstWave =
              elapsed - RESOLVE_DONE - WAVE_INITIAL_DELAY;
            if (sinceFirstWave >= 0 && !tabHidden.current && dp < 0.1) {
              const cyclePos = sinceFirstWave % WAVE_INTERVAL;
              if (cyclePos < WAVE_DURATION) {
                const t = cyclePos / WAVE_DURATION;
                const ease = t * t * (3 - 2 * t);
                const headX = -WAVE_BAND + ease * waveSpan;
                const wavePos = headX - r * WAVE_SKEW;
                const dist = Math.abs(c - wavePos);
                if (dist < WAVE_BAND) {
                  const u = 1 - dist / WAVE_BAND;
                  waveBoost = u * u * (3 - 2 * u) * 0.85;
                }
              }
            }

            const decayed = Math.max(0, cell.flicker - 0.06);
            const flicker = Math.max(decayed, waveBoost);

            let ch: Ramp | " " = " ";
            let progress = 0;

            if (aProgress <= 0) {
              ch = " ";
              progress = 0;
            } else if (sProgress <= 0) {
              const jitter = pseudoRandom(r * 31 + c, Math.floor(elapsed / 80));
              ch = jitter < 0.85 ? "░" : "·";
              progress = 0;
            } else {
              progress = easeOutCubic(sProgress);
              const eff = Math.max(0, progress - flicker * 0.75);
              ch = rampForProgress(eff);
            }

            // Dissolve: reverse crystal growth — cells erode from edges inward
            if (dp > 0.02 && elapsed > RESOLVE_DONE) {
              const threshold = DISSOLVE_THRESHOLDS.get(key) ?? 0.5;

              const local = dp - threshold;
              if (local >= 0.04) {
                ch = " ";
                progress = 0;
              } else if (local >= 0.02) {
                ch = "·";
                progress = 0.05;
              } else if (local >= 0) {
                ch = "░";
                progress = 0.2;
              }
            }

            next[r][c] = { ch, isFilled: true, progress, flicker };
          }
        }

        return next;
      });

      // Glow swell (suppress during dissolve)
      const sinceFirstWave = elapsed - RESOLVE_DONE - WAVE_INITIAL_DELAY;
      let nextGlow = 0;
      if (sinceFirstWave >= 0 && dp < 0.1) {
        const cyclePos = sinceFirstWave % WAVE_INTERVAL;
        if (cyclePos < WAVE_DURATION) {
          const t = cyclePos / WAVE_DURATION;
          nextGlow = Math.sin(t * Math.PI);
        }
      }

      // Resolve flash — one-shot glow spike when wordmark finishes setting
      const resolveFlash =
        elapsed > RESOLVE_DONE && elapsed < RESOLVE_DONE + 700
          ? Math.max(0, 1 - (elapsed - RESOLVE_DONE) / 700) * 0.8
          : 0;

      setGlow(nextGlow + resolveFlash);

      raf = requestAnimationFrame(tick);
      rafRef.current = raf;
    };

    raf = requestAnimationFrame(tick);
    rafRef.current = raf;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  const text = useMemo(
    () => grid.map((row) => row.map((c) => c.ch).join("")).join("\n"),
    [grid],
  );

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={(e) => {
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
        el.style.setProperty("--m-opacity", "1");
      }}
      onMouseLeave={() => {
        const el = wrapRef.current;
        if (!el) return;
        el.style.setProperty("--m-opacity", "0");
      }}
    >
      <pre
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 select-none whitespace-pre text-center text-[var(--fg-quietest)] leading-[1.05] text-[9px] min-[420px]:text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          transform: "translate(2px, 2px)",
          opacity: 0.5,
        }}
      >
        {text}
      </pre>
      <pre
        ref={preRef}
        aria-label="Taylor"
        className="relative m-0 select-none whitespace-pre text-center text-[var(--fg-peak)] leading-[1.05] text-[9px] min-[420px]:text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          textShadow: [
            "0 0 0.5px rgba(244, 241, 234, 0.7)",
            `0 0 ${8 + glow * 6}px rgba(244, 241, 234, ${0.08 + glow * 0.1})`,
            `0 0 ${28 + glow * 18}px rgba(244, 241, 234, ${0.06 + glow * 0.08})`,
            "0 1px 0 rgba(0, 0, 0, 0.4)",
          ].join(", "),
          transition: "text-shadow 80ms linear",
        }}
      >
        {text}
      </pre>
      <pre
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 select-none whitespace-pre text-center leading-[1.05] text-[9px] min-[420px]:text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          color: "#ffffff",
          opacity: "var(--m-opacity, 0)",
          textShadow:
            "0 0 4px rgba(255,255,255,0.55), 0 0 12px rgba(255,255,255,0.3), 0 0 24px rgba(244,241,234,0.18)",
          WebkitMaskImage:
            "radial-gradient(circle 150px at var(--mx, -300px) var(--my, -300px), black 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.35) 65%, transparent 100%)",
          maskImage:
            "radial-gradient(circle 150px at var(--mx, -300px) var(--my, -300px), black 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.35) 65%, transparent 100%)",
          transition: "opacity 180ms ease",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
