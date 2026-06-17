import { describe, expect, it } from "vitest";
import {
  INTRO_BLOOM_END,
  INTRO_DORMANT_END,
  INTRO_PEAK_END,
  INTRO_RECEDE_END,
  TAU_AMBIENT,
  bloomEase,
  easeFactor,
  flowAtlasIndex,
  introEnvelope,
} from "@/lib/ascii/field";
import { AMBIENT_CEIL, ATLAS_BACKSLASH, ATLAS_PIPE } from "@/lib/ascii/ramp";

describe("easeFactor", () => {
  it("converges current to target without overshoot", () => {
    let current = 0;
    const target = 10;
    for (let f = 0; f < 60; f++) {
      const k = easeFactor(16, TAU_AMBIENT);
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThan(1);
      current += (target - current) * k;
      expect(current).toBeLessThanOrEqual(target);
    }
    expect(current).toBeGreaterThan(target * 0.95);
  });
});

describe("bloomEase", () => {
  it("clamps and eases 1-(1-t)^1.8", () => {
    expect(bloomEase(-1)).toBe(0);
    expect(bloomEase(0)).toBe(0);
    expect(bloomEase(1)).toBe(1);
    expect(bloomEase(2)).toBe(1);
    expect(bloomEase(0.5)).toBeGreaterThan(0.5); // ease-out
  });
});

describe("introEnvelope", () => {
  const out = { mask: 0, crest: 0 };
  // worst-case target proxy: a max-ambient cell
  const proxy = (d: number, j: number, t: number) => {
    introEnvelope(d, j, t, out);
    return AMBIENT_CEIL * out.mask + out.crest;
  };

  it("is continuous at every phase boundary — no jump > 1 ramp step (§10.2)", () => {
    for (const b of [INTRO_DORMANT_END, INTRO_BLOOM_END, INTRO_PEAK_END, INTRO_RECEDE_END]) {
      for (const d of [0, 0.25, 0.5, 0.75, 1]) {
        for (const j of [-60, 0, 60]) {
          expect(Math.abs(proxy(d, j, b + 1) - proxy(d, j, b - 1))).toBeLessThan(1);
        }
      }
    }
  });

  it("settles to mask 1, crest 0 after the intro", () => {
    introEnvelope(0.5, 0, INTRO_RECEDE_END + 1000, out);
    expect(out.mask).toBe(1);
    expect(out.crest).toBe(0);
    introEnvelope(0.5, 0, Number.POSITIVE_INFINITY, out);
    expect(out.mask).toBe(1);
  });

  it("the traveling front crests well above ambient mid-bloom", () => {
    let maxCrest = 0;
    for (let d = 0; d <= 1; d += 0.01) {
      introEnvelope(d, 0, 1400, out);
      maxCrest = Math.max(maxCrest, out.crest);
    }
    expect(maxCrest).toBeGreaterThan(3); // +6 crest, gaussian peak on the front line
  });

  it("recedes edges-first, center-last", () => {
    const mid = (INTRO_PEAK_END + INTRO_RECEDE_END) / 2;
    introEnvelope(1, 0, mid, out);
    const edge = out.mask;
    introEnvelope(0, 0, mid, out);
    const center = out.mask;
    expect(edge).toBeLessThan(center);
  });
});

describe("flowAtlasIndex", () => {
  it("returns -1 for flat gradients (keep the ramp glyph)", () => {
    expect(flowAtlasIndex(0, 0)).toBe(-1);
    expect(flowAtlasIndex(0.1, 0.1)).toBe(-1);
  });

  it("aligns strokes with the flow, perpendicular to the gradient", () => {
    expect(flowAtlasIndex(1, 0)).toBe(ATLAS_PIPE); // horizontal gradient → vertical contour
    expect(flowAtlasIndex(0, 1)).toBe(2); // vertical gradient → "-" (ramp index 2)
    expect(flowAtlasIndex(1, 1)).toBe(4); // down-right gradient → "/" (ramp index 4)
    expect(flowAtlasIndex(1, -1)).toBe(ATLAS_BACKSLASH); // up-right gradient → "\"
  });
});
