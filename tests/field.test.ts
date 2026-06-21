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
import { FieldEngine, type FieldFrameInput } from "@/lib/ascii/field";

function neutralInput(now = 10_000): FieldFrameInput {
  return {
    now,
    introElapsed: Number.POSITIVE_INFINITY,
    heroDissolve: 1,
    footerGravity: 0,
    zones: [],
    ripples: [],
    scrollDrift: 0,
  };
}

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

describe("FieldEngine", () => {
  const make = () => new FieldEngine(40, 20, 7.8, 17.55, 312, 351, 3);

  it("ambient targets never exceed the ceiling — letters are ceremony-only (§1)", () => {
    const e = make();
    e.recomputeTargets(neutralInput());
    for (let i = 0; i < e.total; i++) {
      expect(e.target[i]).toBeLessThanOrEqual(AMBIENT_CEIL);
      expect(e.target[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("roughly half the field rests at or near space (§3 contrast curve)", () => {
    const e = make();
    e.recomputeTargets(neutralInput());
    let nearEmpty = 0;
    for (let i = 0; i < e.total; i++) if (e.target[i] < 1) nearEmpty++;
    expect(nearEmpty / e.total).toBeGreaterThan(0.25);
  });

  it("ease() converges current toward target", () => {
    const e = make();
    e.recomputeTargets(neutralInput());
    let before = 0;
    for (let i = 0; i < e.total; i++) before += Math.abs(e.target[i] - e.current[i]);
    for (let f = 0; f < 30; f++) e.ease(16);
    let after = 0;
    for (let i = 0; i < e.total; i++) after += Math.abs(e.target[i] - e.current[i]);
    expect(after).toBeLessThan(before * 0.2);
  });

  it("settle() snaps current to target (reduced-motion static frame)", () => {
    const e = make();
    e.recomputeTargets(neutralInput());
    e.settle();
    for (let i = 0; i < e.total; i++) expect(e.current[i]).toBe(e.target[i]);
  });

  it("the cursor trail lifts cells toward the dense end (§4)", () => {
    const e = make();
    const now = 10_000;
    e.recomputeTargets(neutralInput(now));
    const base = e.target.slice();
    // a short cursor sweep — a wake is many overlapping samples, not one
    for (let s = 0; s < 6; s++) e.addTrailSample(146 + s * 4, 175, now - s * 16, 0.2);
    e.recomputeTargets(neutralInput(now));
    let maxLift = 0;
    for (let i = 0; i < e.total; i++) maxLift = Math.max(maxLift, e.target[i] - base[i]);
    expect(maxLift).toBeGreaterThan(2);
    expect(maxLift).toBeLessThanOrEqual(8.01);
  });

  it("footer gravity floods the lower viewport (§6)", () => {
    const e = make();
    e.recomputeTargets({ ...neutralInput(), footerGravity: 0.75 });
    const lastRow = (e.rows - 1) * e.cols;
    for (let c = 0; c < e.cols; c++) {
      // gravity term alone is 0.75 × ~0.975 × 12 ≈ 8.8 — every bottom cell lifts
      expect(e.target[lastRow + c]).toBeGreaterThan(8);
    }
  });

  it("the final void quiets the field past footerGravity 0.8 (§6)", () => {
    const e = make();
    e.recomputeTargets({ ...neutralInput(), footerGravity: 1 });
    for (let i = 0; i < e.total; i++) expect(e.target[i]).toBe(0);
  });

  it("a ripple adds a traveling band (§3b)", () => {
    const e = make();
    const now = 10_000;
    e.recomputeTargets(neutralInput(now));
    const base = e.target.slice();
    const ripples = [{ x: 156, y: 175, start: now - 300, amp: 4, life: 900, kind: "click" as const }];
    e.recomputeTargets({ ...neutralInput(now), ripples });
    let maxLift = 0;
    for (let i = 0; i < e.total; i++) maxLift = Math.max(maxLift, e.target[i] - base[i]);
    expect(maxLift).toBeGreaterThan(1);
  });

  it("flowIndexAt is safe at the grid edges", () => {
    const e = make();
    e.recomputeTargets(neutralInput());
    expect(() => {
      e.flowIndexAt(0);
      e.flowIndexAt(e.cols - 1);
      e.flowIndexAt(e.total - 1);
    }).not.toThrow();
  });
});
