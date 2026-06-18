"use client";

import { useCallback, useEffect, useRef } from "react";
import { ATLAS_GLYPHS, ATLAS_LEN, coverageNorm, luminance } from "@/lib/ascii/ramp";
import { FieldEngine, FLOW_MAX, FLOW_MIN } from "@/lib/ascii/field";
import { getSnapshot } from "@/lib/scroll-store";
import { emitClick, getRipples } from "@/lib/ascii/pulse-store";
import { erosionZones } from "@/components/shared/SectionWrapper";

const LINE_HEIGHT = 1.35;

// §3b-C scroll drag: capped counter-advection, decays back to ambient wind
const SCROLL_DRIFT_GAIN = 0.4;
const SCROLL_DRIFT_CAP = 120; // px
const SCROLL_DRIFT_TAU = 500; // ms

function fontSizeFor(w: number): number {
  return w < 768 ? 15 : 13; // §7 mobile cell-size increase
}

function resolveFontStack(): string {
  // canvas can't use var() — resolve the identity font's generated family name (§7)
  const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return `${fam ? `${fam}, ` : ""}ui-monospace, "SF Mono", Menlo, monospace`;
}

interface AtlasBundle {
  canvas: HTMLCanvasElement;
  covNorm: Float32Array;
  glyphWPx: number;
  glyphHPx: number;
}

function buildAtlas(fontSize: number, charW: number, charH: number, dpr: number): AtlasBundle {
  const glyphWPx = Math.ceil(charW * dpr);
  const glyphHPx = Math.ceil(charH * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = glyphWPx * ATLAS_LEN;
  canvas.height = glyphHPx;
  const actx = canvas.getContext("2d", { willReadFrequently: true })!;
  actx.font = `${fontSize}px ${resolveFontStack()}`;
  actx.textBaseline = "top";
  actx.fillStyle = "rgb(200, 198, 194)";
  for (let g = 1; g < ATLAS_LEN; g++) {
    // per-glyph transform pins each glyph to its integer-px slot — no drift
    actx.setTransform(dpr, 0, 0, dpr, g * glyphWPx, 0);
    actx.fillText(ATLAS_GLYPHS[g], 0, (charH - fontSize) / 2);
  }
  actx.setTransform(1, 0, 0, 1, 0, 0);

  // measure per-glyph ink coverage from the atlas pixels (§1)
  const coverage = new Float32Array(ATLAS_LEN);
  const img = actx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let g = 1; g < ATLAS_LEN; g++) {
    let sum = 0;
    for (let y = 0; y < glyphHPx; y++) {
      let off = (y * canvas.width + g * glyphWPx) * 4 + 3;
      for (let x = 0; x < glyphWPx; x++, off += 4) sum += img[off];
    }
    coverage[g] = sum / (glyphWPx * glyphHPx * 255);
  }
  return { canvas, covNorm: coverageNorm(coverage), glyphWPx, glyphHPx };
}

interface GridState {
  engine: FieldEngine;
  cols: number;
  rows: number;
  charW: number;
  charH: number;
  fontSize: number;
  atlas: AtlasBundle;
  dpr: number;
  raf: number;
  paused: boolean;
  mountTime: number;
  lastFrame: number;
  frame: number;
  mobile: boolean;
  lastPX: number;
  lastPY: number;
  lastPT: number;
  scrollDrift: number;
  lastScrollY: number;
}

export function AsciiGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GridState | null>(null);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mobile = w < 768;
    const dpr = Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1); // §8 DPR cap

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const fontSize = fontSizeFor(w);
    const charW = fontSize * 0.6;
    const charH = fontSize * LINE_HEIGHT;
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);

    // grid discipline (§6c): DOM content and field cells share one lattice
    document.documentElement.style.setProperty("--ascii-cols", String(cols));
    document.documentElement.style.setProperty("--ascii-rows", String(rows));
    document.documentElement.style.setProperty("--ascii-ch", `${charW}px`);
    document.documentElement.style.setProperty("--ascii-line", `${charH}px`);

    const prev = stateRef.current;
    stateRef.current = {
      engine: new FieldEngine(cols, rows, charW, charH, w, h, mobile ? 2 : 3),
      cols,
      rows,
      charW,
      charH,
      fontSize,
      atlas: buildAtlas(fontSize, charW, charH, dpr),
      dpr,
      raf: prev?.raf ?? 0,
      paused: prev?.paused ?? false,
      mountTime: prev?.mountTime ?? performance.now(),
      lastFrame: performance.now(),
      frame: 0,
      mobile,
      lastPX: prev?.lastPX ?? -1e9,
      lastPY: prev?.lastPY ?? -1e9,
      lastPT: prev?.lastPT ?? 0,
      scrollDrift: prev?.scrollDrift ?? 0,
      lastScrollY: window.scrollY,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    resize();

    const drawFrame = () => {
      const s = stateRef.current;
      if (!s) return;
      const { engine, atlas, cols, rows, charW, charH, dpr } = s;
      const cur = engine.current;
      const cov = atlas.covNorm;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      for (let row = 0; row < rows; row++) {
        const y = row * charH;
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col;
          const c = cur[i];
          const idx = Math.round(c);
          if (idx <= 0) continue; // sparse field: skip-draw (§8)
          let atlasIdx = idx;
          if (idx >= FLOW_MIN && idx <= FLOW_MAX) {
            // §3b-A: mid-band cells render as flow-aligned strokes
            const f = engine.flowIndexAt(i);
            if (f >= 0) atlasIdx = f;
          }
          const alpha = luminance(c) * cov[atlasIdx];
          if (alpha < 0.01) continue;
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.drawImage(
            atlas.canvas,
            atlasIdx * atlas.glyphWPx,
            0,
            atlas.glyphWPx,
            atlas.glyphHPx,
            col * charW,
            y,
            charW,
            charH,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const recompute = (now: number) => {
      const s = stateRef.current;
      if (!s) return;
      const scroll = getSnapshot();
      s.engine.recomputeTargets({
        now,
        introElapsed: reduced ? Number.POSITIVE_INFINITY : now - s.mountTime,
        heroDissolve: scroll.heroDissolve,
        footerGravity: scroll.footerGravity,
        zones: erosionZones,
        ripples: getRipples(now),
        scrollDrift: s.scrollDrift,
      });
    };

    const loop = (now: number) => {
      const s = stateRef.current;
      if (!s || s.paused) return;
      const dt = Math.min(100, Math.max(0.01, now - s.lastFrame));
      s.lastFrame = now;
      s.frame++;

      // §3b-C: scrolling reads as moving through the medium
      const sy = window.scrollY;
      const dScroll = sy - s.lastScrollY;
      s.lastScrollY = sy;
      s.scrollDrift = Math.max(
        -SCROLL_DRIFT_CAP,
        Math.min(SCROLL_DRIFT_CAP, s.scrollDrift + dScroll * SCROLL_DRIFT_GAIN),
      );
      s.scrollDrift *= Math.exp(-dt / SCROLL_DRIFT_TAU);

      // §8: expensive target pass at 30/20Hz, easing + draw every frame
      if (s.frame % (s.mobile ? 3 : 2) === 0) recompute(now);
      s.engine.ease(dt);
      drawFrame();
      s.raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || e.pointerType !== "mouse" || s.mobile) return; // trail is desktop-only (§4)
      const now = performance.now();
      const dx = e.clientX - s.lastPX;
      const dy = e.clientY - s.lastPY;
      const dtp = Math.max(1, now - s.lastPT);
      const speed = s.lastPX < -1e8 ? 0 : Math.sqrt(dx * dx + dy * dy) / dtp;
      s.lastPX = e.clientX;
      s.lastPY = e.clientY;
      s.lastPT = now;
      s.engine.addTrailSample(e.clientX, e.clientY, now, speed);
    };

    const onPointerDown = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const now = performance.now();
      if (e.pointerType === "mouse" && !s.mobile) {
        emitClick(e.clientX, e.clientY, now); // §3b-C: touch the ink
      } else {
        s.engine.addTrailSample(e.clientX, e.clientY, now, 0); // tap halo (§4)
      }
    };

    const onVisibility = () => {
      const s = stateRef.current;
      if (!s) return;
      s.paused = document.hidden;
      if (!document.hidden) {
        s.lastFrame = performance.now();
        s.raf = requestAnimationFrame(loop);
      }
    };

    const staticFrame = () => {
      const s = stateRef.current;
      if (!s) return;
      recompute(performance.now());
      s.engine.settle();
      drawFrame();
    };

    let resizeTimer: number | undefined;
    const onResize = () => {
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        resizeTimer = undefined;
        if (reduced) staticFrame();
      }, 150);
    };

    // the identity font loads async — rebuild the atlas once, same metrics box (§7)
    let disposed = false;
    document.fonts.ready.then(() => {
      const s = stateRef.current;
      if (disposed || !s) return;
      s.atlas = buildAtlas(s.fontSize, s.charW, s.charH, s.dpr);
      if (reduced) drawFrame();
    });

    if (reduced) {
      // §10.5: single static frame, zero rAF after first paint, no input listeners
      staticFrame();
      window.addEventListener("resize", onResize);
      return () => {
        disposed = true;
        if (resizeTimer !== undefined) clearTimeout(resizeTimer);
        window.removeEventListener("resize", onResize);
        stateRef.current = null;
      };
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    stateRef.current!.raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      const s = stateRef.current;
      if (s) cancelAnimationFrame(s.raf);
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      stateRef.current = null;
    };
  }, [resize]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
