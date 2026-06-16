import { describe, expect, it } from "vitest";
import { buildPerm, fbm, smoothstep, valueNoise3, warpedFbm } from "@/lib/ascii/noise";

const perm = buildPerm(1337);

describe("valueNoise3 / fbm / warpedFbm", () => {
  it("stays in [0, 1]", () => {
    for (let i = 0; i < 2000; i++) {
      const v = warpedFbm(perm, i * 0.137, i * 0.291, i * 0.011, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("is continuous — small steps give small changes", () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.731;
      const y = i * 0.417;
      const a = warpedFbm(perm, x, y, 0.5, 3);
      const b = warpedFbm(perm, x + 0.001, y, 0.5, 3);
      expect(Math.abs(a - b)).toBeLessThan(0.05);
    }
  });

  it("is deterministic per seed and varies across seeds", () => {
    const again = buildPerm(1337);
    const other = buildPerm(99);
    let diff = 0;
    for (let i = 0; i < 10; i++) {
      const x = 1.7 + i * 2.31;
      const y = 4.2 + i * 1.13;
      expect(valueNoise3(perm, x, y, 0.5)).toBe(valueNoise3(again, x, y, 0.5));
      diff += Math.abs(valueNoise3(perm, x, y, 0.5) - valueNoise3(other, x, y, 0.5));
    }
    expect(diff).toBeGreaterThan(0);
  });

  it("fbm with fewer octaves still lands in [0, 1] (mobile path)", () => {
    for (let i = 0; i < 500; i++) {
      const v = fbm(perm, i * 0.37, i * 0.61, 0.2, 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("smoothstep", () => {
  it("clamps and eases between the edges", () => {
    expect(smoothstep(0.42, 0.85, 0)).toBe(0);
    expect(smoothstep(0.42, 0.85, 1)).toBe(1);
    expect(smoothstep(0.42, 0.85, 0.635)).toBeCloseTo(0.5, 1);
  });
});
