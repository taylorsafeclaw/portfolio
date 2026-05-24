// lib/ascii/density.ts

import { RAMP, RAMP_LEN } from "@/lib/ascii/ramp";

/** Sinusoidal breathing: returns an opacity delta for a cell at time `now` */
export function breathingAlpha(
  col: number,
  row: number,
  now: number,
  period: number = 7000,
): number {
  const phase = Math.sin((now / period) * Math.PI * 2 + col * 0.15 + row * 0.2);
  return phase * 0.03;
}

/** Sparkle: returns a ramp boost (0 or positive) for a cell. Sparse, random. */
export function sparkleBoost(
  cellIndex: number,
  now: number,
  rate: number = 2.5,
  totalCells: number,
): number {
  const cycle = 400;
  const slot = Math.floor(now / cycle);
  const hash = ((slot * 7919 + cellIndex * 104729) % totalCells);
  const isSparkle = hash < Math.ceil(rate);
  if (!isSparkle) return 0;
  const t = (now % cycle) / cycle;
  const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
  return Math.floor(intensity * 3);
}

export interface ErosionZone {
  centerX: number;
  centerY: number;
  radius: number;
  progress: number; // 0 = no erosion, 1 = fully eroded
  shape: "center-out" | "top-down" | "edges-in" | "bottom-up";
}

/** Erosion: returns an alpha multiplier (0–1) for a cell given active zones */
export function erosionAlpha(
  cellX: number,
  cellY: number,
  viewportW: number,
  viewportH: number,
  zones: ErosionZone[],
): number {
  let alpha = 1;
  for (const zone of zones) {
    if (zone.progress <= 0) continue;
    let dist: number;
    switch (zone.shape) {
      case "center-out": {
        const dx = (cellX - zone.centerX) / viewportW;
        const dy = (cellY - zone.centerY) / viewportH;
        dist = Math.sqrt(dx * dx + dy * dy) * 2;
        break;
      }
      case "top-down": {
        dist = (cellY - zone.centerY + zone.radius) / (zone.radius * 2);
        break;
      }
      case "edges-in": {
        const edgeDist = Math.min(
          cellX / viewportW,
          (viewportW - cellX) / viewportW,
          cellY / viewportH,
          (viewportH - cellY) / viewportH,
        ) * 4;
        dist = 1 - edgeDist;
        break;
      }
      case "bottom-up": {
        dist = 1 - (cellY - zone.centerY + zone.radius) / (zone.radius * 2);
        break;
      }
    }
    const erosion = Math.max(0, 1 - Math.max(0, dist) / Math.max(0.01, 1 - zone.progress));
    alpha *= 1 - erosion;
  }
  return Math.max(0, Math.min(1, alpha));
}

/** Clamp a value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
