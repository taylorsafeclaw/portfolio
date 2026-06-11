import { describe, expect, it } from "vitest";
import {
  AMBIENT_CEIL,
  ATLAS_GLYPHS,
  ATLAS_LEN,
  FIELD_RAMP,
  FIELD_RAMP_LEN,
  SCRAMBLE_CHARS,
  coverageNorm,
  luminance,
} from "@/lib/ascii/ramp";

describe("FIELD_RAMP", () => {
  it("has 25 steps, a true space at index 0, and TAYL0R at the dense end", () => {
    expect(FIELD_RAMP_LEN).toBe(25);
    expect(FIELD_RAMP[0]).toBe(" ");
    expect([...FIELD_RAMP].slice(-6).reverse().join("")).toBe("TAYL0R");
  });

  it("keeps the name letters above the ambient ceiling", () => {
    for (let i = 1; i <= AMBIENT_CEIL; i++) {
      expect("TAYL0R").not.toContain(FIELD_RAMP[i]);
    }
  });

  it("scramble charset is drawn from the mid-ramp", () => {
    for (const ch of SCRAMBLE_CHARS) {
      const idx = FIELD_RAMP.indexOf(ch as (typeof FIELD_RAMP)[number]);
      expect(idx).toBeGreaterThanOrEqual(3);
      expect(idx).toBeLessThanOrEqual(AMBIENT_CEIL);
    }
  });

  it("atlas glyph list is the ramp plus the two flow-only strokes", () => {
    expect(ATLAS_LEN).toBe(FIELD_RAMP_LEN + 2);
    expect(ATLAS_GLYPHS[FIELD_RAMP_LEN]).toBe("\\");
    expect(ATLAS_GLYPHS[FIELD_RAMP_LEN + 1]).toBe("|");
  });
});

describe("luminance", () => {
  it("is 0 at space and strictly increasing along the ramp", () => {
    expect(luminance(0)).toBe(0);
    let prev = 0;
    for (let i = 1; i < FIELD_RAMP_LEN; i++) {
      const l = luminance(i);
      expect(l).toBeGreaterThan(prev);
      prev = l;
    }
  });

  it("tops out near the spec's alpha ceilings", () => {
    expect(luminance(AMBIENT_CEIL)).toBeGreaterThan(0.13); // ambient alpha ceiling ~0.16
    expect(luminance(AMBIENT_CEIL)).toBeLessThan(0.18);
    expect(luminance(FIELD_RAMP_LEN - 1)).toBeLessThanOrEqual(0.3);
  });
});

describe("coverageNorm", () => {
  it("keeps perceived brightness monotonic regardless of glyph shape", () => {
    // jumbled synthetic coverages — like real glyphs, L and Y carry less ink than 0 and A
    const coverage = new Float32Array(FIELD_RAMP_LEN);
    for (let i = 1; i < FIELD_RAMP_LEN; i++) {
      coverage[i] = 0.15 + ((i * 37) % 11) / 40;
    }
    const norm = coverageNorm(coverage);
    let prev = 0;
    for (let i = 1; i < FIELD_RAMP_LEN; i++) {
      const perceived = luminance(i) * norm[i] * coverage[i];
      expect(perceived).toBeGreaterThan(prev);
      prev = perceived;
    }
  });
});
