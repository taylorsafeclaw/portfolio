"use client";

import { useEffect, useRef, useCallback } from "react";
import { RAMP, RAMP_LEN } from "@/lib/ascii/ramp";
import { getSnapshot } from "@/lib/scroll-store";
import { IntroEngine, INTRO_DURATION } from "@/lib/ascii/intro";
import { breathingAlpha, sparkleBoost, erosionAlpha } from "@/lib/ascii/density";
import { erosionZones } from "@/components/shared/SectionWrapper";

const FONT_SIZE = 13;
const LINE_HEIGHT = 1.35;
const CHURN_COUNT = 12;
const CHURN_MS = 300;
const LIGHT_BIAS = [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];

// Mouse proximity: local ramp shift (Aino-style)
const HALO_RADIUS = 140;
const HALO_BOOST = 4;

const FILL_STYLES: string[] = [];
for (let i = 0; i <= 100; i++) {
  FILL_STYLES[i] = `rgba(200, 198, 194, ${(i / 100).toFixed(3)})`;
}

function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface GridState {
  cols: number;
  rows: number;
  buffer: Uint8Array;
  mouseX: number;
  mouseY: number;
  mouseActive: boolean;
  raf: number;
  churnTimer: number | undefined;
  paused: boolean;
  mountTime: number;
  introEngine: IntroEngine | null;
  introSeeded: boolean;
  vh: number;
  needsCtxReset: boolean;
}

export function AsciiGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GridState | null>(null);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const charW = FONT_SIZE * 0.6;
    const charH = FONT_SIZE * LINE_HEIGHT;
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);
    const total = cols * rows;

    const buffer = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      buffer[i] = LIGHT_BIAS[Math.floor(Math.random() * LIGHT_BIAS.length)];
    }

    document.documentElement.style.setProperty("--ascii-cols", String(cols));
    document.documentElement.style.setProperty("--ascii-rows", String(rows));
    document.documentElement.style.setProperty("--ascii-ch", `${charW}px`);
    document.documentElement.style.setProperty("--ascii-line", `${charH}px`);

    const prev = stateRef.current;
    const centerCol = cols / 2;
    const centerRow = rows / 2;

    stateRef.current = {
      cols,
      rows,
      buffer,
      mouseX: prev?.mouseX ?? -9999,
      mouseY: prev?.mouseY ?? -9999,
      mouseActive: prev?.mouseActive ?? false,
      raf: 0,
      churnTimer: undefined,
      paused: prev?.paused ?? false,
      mountTime: prev?.mountTime ?? performance.now(),
      introEngine: prev?.introEngine ?? new IntroEngine(cols, rows, centerCol, centerRow, charW, charH),
      introSeeded: prev?.introSeeded ?? false,
      vh: h,
      needsCtxReset: true,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = getReducedMotion();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    resize();

    const mountTime = stateRef.current!.mountTime;
    const fontStr = `${FONT_SIZE}px ui-monospace, "SF Mono", Menlo, monospace`;

    const draw = (now: number) => {
      const state = stateRef.current;
      if (!state) return;

      const { cols, rows, buffer, mouseX, mouseY, mouseActive, introEngine, vh } = state;
      const charW = FONT_SIZE * 0.6;
      const charH = FONT_SIZE * LINE_HEIGHT;
      const scroll = getSnapshot();
      const elapsed = now - mountTime;
      const introActive = elapsed < INTRO_DURATION && !reduced && introEngine;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      if (state.needsCtxReset) {
        ctx.font = fontStr;
        ctx.textBaseline = "top";
        state.needsCtxReset = false;
      }

      if (!introActive && introEngine && !state.introSeeded) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const result = introEngine.getRamp(c, r, INTRO_DURATION - 1);
            if (result) state.buffer[r * cols + c] = result.rampIdx;
          }
        }
        state.introSeeded = true;
      }

      // Compute per-frame constants outside the cell loop
      const total = cols * rows;
      const sparkleRate = window.innerWidth < 768 ? 1 : 2.5;
      const vw = canvas.width / dpr;
      const vh2 = canvas.height / dpr;

      let haloColMin = 0, haloColMax = -1, haloRowMin = 0, haloRowMax = -1;
      if (mouseActive) {
        const haloColR = Math.ceil(HALO_RADIUS / charW);
        const haloRowR = Math.ceil(HALO_RADIUS / charH);
        const mc = Math.floor(mouseX / charW);
        const mr = Math.floor(mouseY / charH);
        haloColMin = Math.max(0, mc - haloColR);
        haloColMax = Math.min(cols - 1, mc + haloColR);
        haloRowMin = Math.max(0, mr - haloRowR);
        haloRowMax = Math.min(rows - 1, mr + haloRowR);
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const x = c * charW;
          const y = r * charH;

          let drawIdx: number;
          let alpha: number;

          if (introActive) {
            const result = introEngine.getRamp(c, r, elapsed);
            if (!result) continue;
            drawIdx = result.rampIdx;
            alpha = result.alpha;
          } else {
            // Normal ambient mode
            const baseIdx = buffer[idx];
            const viewportNorm = y / vh;
            // Reduced base alpha for site-wide field (~8-10% vs hero's 18%)
            alpha = 0.06 + (baseIdx / RAMP_LEN) * 0.08;
            drawIdx = baseIdx;

            // Breathing wave from density module
            alpha += breathingAlpha(c, r, now);

            // Sparkle: random brief density boost for a cell
            const sparkle = sparkleBoost(idx, now, total, sparkleRate);
            drawIdx = Math.min(RAMP_LEN - 1, drawIdx + sparkle);

            // Scroll reactivity: hero dissolve dims the field
            if (scroll.heroDissolve > 0) {
              alpha *= 1 - scroll.heroDissolve * 0.35;
            }

            // Section divider: density band during scroll transition
            if (scroll.heroDissolve > 0.3 && scroll.heroDissolve < 1.0) {
              const bandCenter = 0.5;
              const bandHeight = 0.08;
              const distFromBand = Math.abs(viewportNorm - bandCenter);
              if (distFromBand < bandHeight) {
                const bandIntensity = 1 - distFromBand / bandHeight;
                const scrollFade =
                  scroll.heroDissolve < 0.5
                    ? (scroll.heroDissolve - 0.3) / 0.2
                    : 1 - (scroll.heroDissolve - 0.8) / 0.2;
                const clampedFade = Math.max(0, Math.min(1, scrollFade));
                const colNorm = c / Math.max(1, cols - 1);
                const colIntensity = 1 - Math.abs(colNorm - 0.5) * 2;
                const boost = bandIntensity * clampedFade * colIntensity;
                drawIdx = Math.min(RAMP_LEN - 2, drawIdx + Math.floor(boost * 5));
                alpha += boost * 0.15;
              }
            }

            // Footer gravity: lower cells densify
            if (scroll.footerGravity > 0) {
              const gravityBoost = scroll.footerGravity * viewportNorm * 4;
              drawIdx = Math.min(RAMP_LEN - 2, drawIdx + Math.floor(gravityBoost));
              alpha += scroll.footerGravity * viewportNorm * 0.2;
            }

            // Final void at page bottom
            if (scroll.footerGravity > 0.8) {
              alpha *= Math.max(0, 1 - (scroll.footerGravity - 0.8) / 0.2);
            }
          }

          // Mouse proximity: local ramp shift (Aino-style)
          if (mouseActive && r >= haloRowMin && r <= haloRowMax && c >= haloColMin && c <= haloColMax) {
            const mdx = x + charW / 2 - mouseX;
            const mdy = y + charH / 2 - mouseY;
            const d = Math.sqrt(mdx * mdx + mdy * mdy);
            if (d < HALO_RADIUS) {
              const proximity = 1 - d / HALO_RADIUS;
              const boost = proximity * proximity * HALO_BOOST;
              drawIdx = Math.min(RAMP_LEN - 2, drawIdx + Math.floor(boost));
              alpha += proximity * 0.2;
            }
          }

          // Erosion zones: dim ASCII field around visible content sections
          if (!introActive && erosionZones.length > 0) {
            alpha *= erosionAlpha(x, y, vw, vh2, erosionZones);
          }

          drawIdx = Math.min(RAMP_LEN - 1, Math.max(0, drawIdx));
          alpha = Math.min(1, Math.max(0, alpha));
          if (alpha < 0.01) continue;

          ctx.fillStyle = FILL_STYLES[Math.round(alpha * 100)];
          ctx.fillText(RAMP[drawIdx], x, y);
        }
      }
    };

    const loop = (now: number) => {
      const state = stateRef.current;
      if (!state || state.paused) return;
      draw(now);
      state.raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      if (stateRef.current) {
        stateRef.current.mouseX = e.clientX;
        stateRef.current.mouseY = e.clientY;
        stateRef.current.mouseActive = true;
      }
    };

    const onTouch = (e: TouchEvent) => {
      if (stateRef.current && e.touches.length > 0) {
        stateRef.current.mouseX = e.touches[0].clientX;
        stateRef.current.mouseY = e.touches[0].clientY;
        stateRef.current.mouseActive = true;
      }
    };

    const onTouchEnd = () => {
      if (stateRef.current) {
        setTimeout(() => {
          if (stateRef.current) stateRef.current.mouseActive = false;
        }, 600);
      }
    };

    const onLeave = () => {
      if (stateRef.current) stateRef.current.mouseActive = false;
    };

    const onVisibility = () => {
      if (stateRef.current) {
        stateRef.current.paused = document.hidden;
        if (!document.hidden) {
          stateRef.current.raf = requestAnimationFrame(loop);
        }
      }
    };

    let resizeTimer: number | undefined;
    const onResize = () => {
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        resizeTimer = undefined;
      }, 150);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);

    if (reduced) {
      if (stateRef.current) stateRef.current.introEngine = null;
      draw(performance.now());
    } else {
      const churnTimer = window.setInterval(() => {
        const state = stateRef.current;
        if (!state || state.paused) return;
        // Halve churn count on mobile to reduce CPU work per interval
        const churnCount = window.innerWidth < 768 ? 6 : CHURN_COUNT;
        for (let i = 0; i < churnCount; i++) {
          const idx = Math.floor(Math.random() * state.buffer.length);
          state.buffer[idx] =
            LIGHT_BIAS[Math.floor(Math.random() * LIGHT_BIAS.length)];
        }
      }, CHURN_MS);

      if (stateRef.current) stateRef.current.churnTimer = churnTimer;
      stateRef.current!.raf = requestAnimationFrame(loop);
    }

    return () => {
      const state = stateRef.current;
      if (state) {
        cancelAnimationFrame(state.raf);
        if (state.churnTimer) clearInterval(state.churnTimer);
      }
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      stateRef.current = null;
    };
  }, [resize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
