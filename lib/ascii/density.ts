// lib/ascii/density.ts

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
        const dx = viewportW > 0 ? (cellX - zone.centerX) / viewportW : 0;
        const dy = viewportH > 0 ? (cellY - zone.centerY) / viewportH : 0;
        dist = Math.sqrt(dx * dx + dy * dy) * 2;
        break;
      }
      case "top-down": {
        dist = (cellY - zone.centerY + zone.radius) / Math.max(0.01, zone.radius * 2);
        break;
      }
      case "edges-in": {
        if (viewportW <= 0 || viewportH <= 0) { dist = 0; break; }
        const edgeDist = Math.min(
          cellX / viewportW,
          (viewportW - cellX) / viewportW,
          cellY / viewportH,
          (viewportH - cellY) / viewportH,
        ) * 4;
        dist = edgeDist;
        break;
      }
      case "bottom-up": {
        dist = 1 - (cellY - zone.centerY + zone.radius) / Math.max(0.01, zone.radius * 2);
        break;
      }
    }
    const erosion = Math.max(0, 1 - Math.max(0, dist) / Math.max(0.01, zone.progress));
    alpha *= 1 - erosion;
  }
  return Math.max(0, Math.min(1, alpha));
}

/** Clamp a value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
