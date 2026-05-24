"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getReducedMotion() {
  return window.matchMedia(REDUCED_QUERY).matches;
}
function getServerReducedMotion() {
  return false;
}

const RAMP = ["·", "░", "▒", "▓", "█"] as const;
type Ramp = (typeof RAMP)[number];

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
  const height = 6;
  for (let r = 0; r < height; r++) {
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

// Animation timing
const APPEAR_START = 250;
const APPEAR_DURATION = 1100; // cells fade in as ░
const SET_START = APPEAR_START + APPEAR_DURATION + 120; // start ink-set
const SET_DURATION = 1100; // ░ → █ ramp climb
const RESOLVE_DONE = SET_START + SET_DURATION;

// Density wave: a diagonal pulse travels through the wordmark, briefly
// down-stepping cells on the ramp (█ → ▓ → ▒) as it passes — like a sheen
// of light moving across inked type. Native to the ASCII medium.
const WAVE_INITIAL_DELAY = 5000; // first wave fires 5s after resolve
const WAVE_INTERVAL = 5200; // gap between waves (slightly off-grid)
const WAVE_DURATION = 1700; // travel time across the word
const WAVE_BAND = 5; // horizontal influence radius (in cells)
const WAVE_SKEW = 0.7; // diagonal slope (0 = vertical wave; 1 = ~45°)

type Cell = {
  ch: Ramp | " ";
  isFilled: boolean;
  // 0..1 progression for current phase (used to drive ramp character)
  progress: number;
  // for shimmer: a transient offset that decays back to 0
  flicker: number;
};

function rampForProgress(p: number): Ramp {
  // Map [0..1] across the ramp without the leading dot — once visible, climb ░→█
  // p=0 → ░, p=1 → █
  const idx = Math.min(RAMP.length - 1, 1 + Math.floor(p * (RAMP.length - 1)));
  return RAMP[idx];
}

export function Wordmark() {
  const [grid, setGrid] = useState<Cell[][]>(() =>
    RESOLVED_ROWS.map((row) =>
      row.split("").map((c) => ({
        ch: " ",
        isFilled: c !== " ",
        progress: 0,
        flicker: 0,
      })),
    ),
  );
  // 0..1 swell that brightens textShadow during the wave pulse
  const [glow, setGlow] = useState(0);

  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );

  const rafRef = useRef<number | null>(null);
  const tabHidden = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    // Build flat list of filled positions
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
              ch: c === " " ? " " : "█",
              isFilled: c !== " ",
              progress: 1,
              flicker: 0,
            })),
          ),
        );
      });
      return () => cancelAnimationFrame(id);
    }

    // Per-cell randomized appear delay (within APPEAR_DURATION)
    // and per-cell randomized ink-set delay (within SET_DURATION)
    const appearDelays = new Map<string, number>();
    const setDelays = new Map<string, number>();
    const shuffledA = [...filled].sort(() => Math.random() - 0.5);
    const shuffledB = [...filled].sort(() => Math.random() - 0.5);
    const appearWindow = APPEAR_DURATION * 0.7;
    const setWindow = SET_DURATION * 0.65;
    shuffledA.forEach(([r, c], i) => {
      const t = (i / Math.max(1, shuffledA.length - 1)) * appearWindow;
      appearDelays.set(`${r},${c}`, t);
    });
    shuffledB.forEach(([r, c], i) => {
      const t = (i / Math.max(1, shuffledB.length - 1)) * setWindow;
      setDelays.set(`${r},${c}`, t);
    });

    const onVisibility = () => {
      tabHidden.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const start = performance.now();
    let raf = 0;
    const totalCols = RESOLVED_ROWS[0].length;
    const totalRows = RESOLVED_ROWS.length;
    // Distance the wave head must travel: full width + diagonal skew + band
    const waveSpan = totalCols + totalRows * WAVE_SKEW + WAVE_BAND * 2;

    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

    const tick = (now: number) => {
      const elapsed = now - start;

      setGrid((prev) => {
        const next = prev.map((row) => row.slice());

        // 1) appear phase: fade in cells as ░ from blank
        // 2) set phase: climb ramp ░ → █
        // 3) shimmer phase: occasional flicker downward (lighter) and recover
        for (let r = 0; r < next.length; r++) {
          for (let c = 0; c < next[r].length; c++) {
            const cell = next[r][c];
            if (!cell.isFilled) continue;
            const key = `${r},${c}`;

            const aDelay = appearDelays.get(key) ?? 0;
            const aLocal = elapsed - APPEAR_START - aDelay;
            const aProgress = Math.max(0, Math.min(1, aLocal / 260));

            const sDelay = setDelays.get(key) ?? 0;
            const sLocal = elapsed - SET_START - sDelay;
            const sProgress = Math.max(0, Math.min(1, sLocal / 420));

            // Compute wave influence at this cell's position
            // Wave fires every WAVE_INTERVAL after RESOLVE_DONE + WAVE_INITIAL_DELAY
            let waveBoost = 0;
            const sinceFirstWave = elapsed - RESOLVE_DONE - WAVE_INITIAL_DELAY;
            if (sinceFirstWave >= 0 && !tabHidden.current) {
              const cyclePos = sinceFirstWave % WAVE_INTERVAL;
              if (cyclePos < WAVE_DURATION) {
                const t = cyclePos / WAVE_DURATION; // 0..1 across travel
                // Smoothstep ease so the head accelerates and decelerates
                const ease = t * t * (3 - 2 * t);
                const headX = -WAVE_BAND + ease * waveSpan;
                // Diagonal: lower rows trail behind upper rows slightly
                const wavePos = headX - r * WAVE_SKEW;
                const dist = Math.abs(c - wavePos);
                if (dist < WAVE_BAND) {
                  // Bell-shaped intensity across the band
                  const u = 1 - dist / WAVE_BAND;
                  waveBoost = u * u * (3 - 2 * u) * 0.85;
                }
              }
            }

            // Flicker = max(decaying previous, current wave boost)
            // Wave drives the value when present; otherwise it decays smoothly
            const decayed = Math.max(0, cell.flicker - 0.06);
            const flicker = Math.max(decayed, waveBoost);

            let ch: Ramp | " " = " ";
            let progress = 0;

            if (aProgress <= 0) {
              ch = " ";
              progress = 0;
            } else if (sProgress <= 0) {
              // Just appeared as ░; tiny micro-jitter between · and ░ at low opacity feel
              const jitter = Math.random();
              ch = jitter < 0.85 ? "░" : "·";
              progress = 0;
            } else {
              progress = easeOutCubic(sProgress);
              // Wave bumps cells DOWN the ramp (█ → ▓ → ▒) — reads as a
              // pulse of light moving across inked type.
              const eff = Math.max(0, progress - flicker * 0.75);
              ch = rampForProgress(eff);
            }

            next[r][c] = { ch, isFilled: true, progress, flicker };
          }
        }

        return next;
      });

      // Synchronized glow swell: textShadow brightens on the wave's leading
      // edge, dims as it trails. Computed once per frame from wave timing.
      const sinceFirstWave = elapsed - RESOLVE_DONE - WAVE_INITIAL_DELAY;
      let nextGlow = 0;
      if (sinceFirstWave >= 0) {
        const cyclePos = sinceFirstWave % WAVE_INTERVAL;
        if (cyclePos < WAVE_DURATION) {
          const t = cyclePos / WAVE_DURATION;
          // sin curve: 0 → 1 → 0 across the wave
          nextGlow = Math.sin(t * Math.PI);
        }
      }
      setGlow(nextGlow);

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
      {/* Dimensional echo — offset, very faint, gives the mark printed weight */}
      <pre
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 select-none whitespace-pre text-center text-[var(--fg-quietest)] leading-[1.05] text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]"
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
        className="relative m-0 select-none whitespace-pre text-center text-[var(--fg-peak)] leading-[1.05] text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]"
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
      {/* Bright cursor spotlight on the letters — masked overlay */}
      <pre
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 select-none whitespace-pre text-center leading-[1.05] text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]"
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
