"use client";

import { useEffect, useRef } from "react";

const RAMP = ["·", ":", "-", "=", "+", "*", "#"];
const CELL_W = 20;
const CELL_H = 26;
const FONT_SIZE = 13;
const HALO = 130;
const HALO_INNER = 55;
const CHURN_MS = 320;

export function AsciiField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let cols = 0;
    let rows = 0;
    let baseChars = new Uint8Array(0);
    let baseTiers = new Uint8Array(0);
    let mouseX = -9999;
    let mouseY = -9999;
    let mouseActive = false;
    let raf = 0;
    let churnTimer: number | undefined;

    const tierColor = (t: number) => {
      if (t === 2) return "rgba(235,232,226,0.32)";
      if (t === 1) return "rgba(210,207,201,0.18)";
      return "rgba(180,177,170,0.10)";
    };

    const fontString = `${FONT_SIZE}px ui-monospace, "SF Mono", Menlo, monospace`;

    const drawBase = () => {
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offCtx.clearRect(0, 0, offscreen.width / dpr, offscreen.height / dpr);
      offCtx.font = fontString;
      offCtx.textBaseline = "top";
      // Batch by tier so we set fillStyle 3 times instead of N
      for (let tier = 0; tier < 3; tier++) {
        offCtx.fillStyle = tierColor(tier);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (baseTiers[idx] !== tier) continue;
            offCtx.fillText(RAMP[baseChars[idx]], c * CELL_W, r * CELL_H);
          }
        }
      }
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;

      cols = Math.ceil(w / CELL_W);
      rows = Math.ceil(h / CELL_H);
      const total = cols * rows;
      baseChars = new Uint8Array(total);
      baseTiers = new Uint8Array(total);
      for (let i = 0; i < total; i++) {
        // Bias char selection toward lighter end of ramp (· : - = dominate)
        const cr = Math.random();
        const charIdx =
          cr < 0.55
            ? Math.floor(Math.random() * 3) // · : -
            : cr < 0.92
              ? 3 + Math.floor(Math.random() * 2) // = +
              : 5 + Math.floor(Math.random() * 2); // * #
        baseChars[i] = charIdx;
        const tr = Math.random();
        baseTiers[i] = tr < 0.88 ? 0 : tr < 0.985 ? 1 : 2;
      }
      drawBase();
    };

    const composeFrame = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0);

      if (!mouseActive) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = fontString;
      ctx.textBaseline = "top";

      const minC = Math.max(0, Math.floor((mouseX - HALO) / CELL_W));
      const maxC = Math.min(cols - 1, Math.ceil((mouseX + HALO) / CELL_W));
      const minR = Math.max(0, Math.floor((mouseY - HALO) / CELL_H));
      const maxR = Math.min(rows - 1, Math.ceil((mouseY + HALO) / CELL_H));

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const x = c * CELL_W;
          const y = r * CELL_H;
          const dx = x + CELL_W / 2 - mouseX;
          const dy = y + CELL_H / 2 - mouseY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > HALO) continue;

          const idx = r * cols + c;
          let charIdx = baseChars[idx];
          let alpha: number;
          if (d < HALO_INNER) {
            charIdx = Math.min(RAMP.length - 1, charIdx + 3);
            alpha = 0.65;
          } else {
            const f = 1 - (d - HALO_INNER) / (HALO - HALO_INNER);
            charIdx = Math.min(RAMP.length - 1, charIdx + 2);
            alpha = 0.18 + f * 0.38;
          }
          ctx.fillStyle = `rgba(235,232,226,${alpha.toFixed(3)})`;
          ctx.fillText(RAMP[charIdx], x, y);
        }
      }
    };

    const loop = () => {
      composeFrame();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseActive = true;
    };
    const onLeave = () => {
      mouseActive = false;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    if (reduced) {
      composeFrame();
    } else {
      churnTimer = window.setInterval(() => {
        for (let i = 0; i < 6; i++) {
          const idx = Math.floor(Math.random() * baseChars.length);
          baseChars[idx] = Math.floor(Math.random() * RAMP.length);
        }
        drawBase();
      }, CHURN_MS);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (churnTimer) clearInterval(churnTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        WebkitMaskImage:
          "radial-gradient(ellipse 90% 80% at 50% 48%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.7) 55%, black 100%)",
        maskImage:
          "radial-gradient(ellipse 90% 80% at 50% 48%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.7) 55%, black 100%)",
      }}
    />
  );
}
