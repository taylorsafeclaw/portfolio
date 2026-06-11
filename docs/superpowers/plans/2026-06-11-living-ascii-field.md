# Living ASCII Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the full-viewport ASCII field per `docs/superpowers/specs/2026-06-11-living-ascii-field-design.md` — branded 25-step ramp, domain-warped noise field, one target/current density pipeline, ink-bloom intro, cursor wake, ripples, flow strokes, and the micro-interaction pass.

**Architecture:** One DOM-free `FieldEngine` (`lib/ascii/field.ts`) holds per-cell `target`/`current` Float32Arrays; targets are recomputed every 2nd/3rd frame from domain-warped fbm plus modulations (intro mask/crest, cursor trail, ripples, erosion, footer gravity), and `current` eases toward `target` every frame with contextual time constants. `AsciiGrid.tsx` stays a thin canvas/input shell: glyph atlas (Monaspace, with measured per-glyph ink coverage), draw loop, pointer/scroll wiring. A tiny `pulse-store` carries wordmark pulses and click ripples into the engine.

**Tech Stack:** Next.js 16 App Router client components, TypeScript strict, canvas 2D + glyph atlas, vitest (new devDependency) for pure-math unit tests. Zero runtime dependencies added.

---

## Context the engineer needs

- **The spec is the source of truth:** `docs/superpowers/specs/2026-06-11-living-ascii-field-design.md`. Section references (§1–§10) below point there.
- **Spec deviation, already decided:** the spec's §6b/§9 mention a `TextGenerate` component. It does not exist in this codebase — only `DensityResolve` and `HeaderDecode` do. Re-tune those two; do not create `TextGenerate`.
- **Legacy exports live until Task 8.** `lib/ascii/ramp.ts`'s old `RAMP`/`RAMP_LEN` and `lib/ascii/intro.ts` are still imported by the old `AsciiGrid` until Task 7 replaces it. Every commit must pass `pnpm typecheck && pnpm lint` — so deletions are deferred to Task 8.
- **Hero timings are untouched:** `components/hero/Hero.tsx` (`RESOLVE_DONE_MS = 4800`, scroll unlock 6000ms) and the Wordmark resolve sequence stay exactly as they are. The only Wordmark change is publishing pulses (Task 9).
- **Repo rules:** no Co-Authored-By trailers on commits. Dark/monochrome/Monaspace only. `prefers-reduced-motion` = single static frame, zero rAF after first paint.
- **Verify loop for every task:** `pnpm test` (after Task 1), then `pnpm typecheck && pnpm lint` before each commit.

## File structure

| file | role |
| --- | --- |
| `lib/ascii/ramp.ts` | ramp data + luminance/coverage math (pure, tested) |
| `lib/ascii/noise.ts` | **new** — seeded value noise, fbm, domain warp (pure, tested) |
| `lib/ascii/pulse-store.ts` | **new** — ripple bus: wordmark pulses + click ripples (pure, tested) |
| `lib/ascii/field.ts` | **new** — FieldEngine + intro envelope + flow buckets (DOM-free, tested) |
| `lib/ascii/density.ts` | keeps `erosionAlpha`/`clamp`; breathing/sparkle deleted in Task 8 |
| `lib/ascii/intro.ts` | **deleted** in Task 8 |
| `lib/ascii/scramble.ts` | default charset → mid-ramp field characters |
| `lib/hooks/useScrambleWalk.ts` | **new** — char-precision scramble hook (ScrambleLink + WorkCard) |
| `components/ascii/AsciiGrid.tsx` | rewritten: atlas + coverage, draw loop, input wiring |
| `components/hero/Wordmark.tsx` | publishes wave pulses to pulse-store |
| `components/hero/ScrambleLink.tsx` | rewritten on useScrambleWalk |
| `components/work/WorkCard.tsx` | title uses useScrambleWalk |
| `components/shared/HeaderDecode.tsx` | charset + shared timing constants |
| `components/story/DensityResolve.tsx` | field-ramp placeholder chars + shared timing |
| `components/footer/Footer.tsx` | live clock |
| `tests/*.test.ts` | **new** — vitest unit tests for the pure math |

---

### Task 1: Branch + vitest harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create the feature branch and record the bundle baseline**

```bash
cd /Users/taylorallen/Development/portfolio
git checkout -b living-ascii-field
pnpm build 2>&1 | tail -20
```

Record the "First Load JS" number for `/` from the build output in a scratch note — Task 14 compares against it (budget: ≤ +3KB gz).

- [ ] **Step 2: Add vitest**

```bash
pnpm add -D vitest
```

Justification (per repo rule "no packages without justification"): spec §10.2 requires unit tests for the pure math; the repo has no test runner. vitest is dev-only — zero bundle cost.

- [ ] **Step 3: Add the test script**

In `package.json` scripts, after `"typecheck"`:

```json
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 5: Verify the harness runs (no tests yet → passes with "no test files found" exit guard)**

Run: `pnpm vitest run --passWithNoTests`
Expected: exits 0.

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest harness for field math tests"
```

---

### Task 2: The 25-step ramp (§1, §7)

**Files:**
- Modify: `lib/ascii/ramp.ts`
- Test: `tests/ramp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/ramp.test.ts`:

```ts
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
    expect(luminance(AMBIENT_CEIL)).toBeGreaterThan(0.13); // ambient ceiling ~0.16
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/ramp.test.ts`
Expected: FAIL — `ramp.ts` has no `FIELD_RAMP` export.

- [ ] **Step 3: Implement `lib/ascii/ramp.ts`**

Replace the file contents with (note: the legacy `RAMP`/`RAMP_LEN` stay at the bottom until Task 8 — old `AsciiGrid`/`intro.ts` still import them):

```ts
// lib/ascii/ramp.ts

/**
 * The field ramp — 25 steps, light → dense (§1). Read backwards from the
 * dense end it spells T-A-Y-L-0-R. Index 0 is a true space: characters can
 * fully leave the field.
 */
export const FIELD_RAMP = [
  " ", "·", "-", ":", "/", "+", "=", ">", "<", "!", "?",
  "3", "I", "2", "5", "4", "6", "9", "8", "R", "0", "L", "Y", "A", "T",
] as const;
export const FIELD_RAMP_LEN = FIELD_RAMP.length;

/** Ambient density never exceeds this index — R 0 L Y A T are ceremony-only (§1). */
export const AMBIENT_CEIL = 14;

/** Block ramp stays for discrete UI indicators — WorkCard, BorderBeam, Wordmark (§1). */
export const BLOCK_RAMP = ["░", "▒", "▓", "█"] as const;

/** Mid-ramp field characters — the shared scramble alphabet (§1, §6b). */
export const SCRAMBLE_CHARS = ":/+=><!?3I25";

/**
 * Atlas glyph list: the full ramp plus the two flow-stroke variants that
 * aren't already ramp members ("-" and "/" are). Atlas index === ramp index
 * for ramp glyphs (§3b-A).
 */
export const ATLAS_GLYPHS: readonly string[] = [...FIELD_RAMP, "\\", "|"];
export const ATLAS_BACKSLASH = FIELD_RAMP_LEN; // 25
export const ATLAS_PIPE = FIELD_RAMP_LEN + 1; // 26
export const ATLAS_LEN = FIELD_RAMP_LEN + 2;

/** Shared materialization timing (§6b) — every ramp-walk on the page uses these. */
export const RESOLVE_CHAR_MS = 400;
export const RESOLVE_SWEEP_MS = 50;

/**
 * Base alpha for a continuous ramp position (0–24). Monotonic; ambient tops
 * out ~0.16 at AMBIENT_CEIL, the full ramp at 0.25 (§2, §3).
 */
export function luminance(rampPos: number): number {
  if (rampPos <= 0) return 0;
  return Math.pow(rampPos / (FIELD_RAMP_LEN - 1), 0.85) * 0.25;
}

/**
 * Per-glyph alpha normalization from measured ink coverage (§1).
 * `coverage[i]` = fraction of atlas pixels inked for glyph i. Drawing with
 * `luminance(pos) × norm[glyph]` makes perceived brightness track the ramp,
 * not the glyph's shape.
 */
export function coverageNorm(coverage: Float32Array): Float32Array {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < coverage.length; i++) {
    if (coverage[i] > 0) {
      sum += coverage[i];
      n++;
    }
  }
  const ref = n > 0 ? sum / n : 1;
  const norm = new Float32Array(coverage.length);
  for (let i = 0; i < coverage.length; i++) {
    norm[i] = coverage[i] > 0 ? Math.min(2.5, ref / coverage[i]) : 1;
  }
  return norm;
}

/** @deprecated Legacy 15-step ramp — deleted in the cleanup task once AsciiGrid is rewritten. */
export const RAMP = ["·", "-", ":", "/", "+", "=", "<", ">", "!", "?", "░", "▒", "▓", "█", "T"] as const;
export const RAMP_LEN = RAMP.length;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/ramp.test.ts && pnpm typecheck && pnpm lint`
Expected: all PASS, typecheck/lint clean (old AsciiGrid still compiles against legacy exports).

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/ramp.ts tests/ramp.test.ts
git commit -m "feat: 25-step field ramp with embedded name, luminance + coverage normalization"
```

---

### Task 3: Noise module (§3)

**Files:**
- Create: `lib/ascii/noise.ts`
- Test: `tests/noise.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/noise.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/noise.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/ascii/noise.ts`**

```ts
// lib/ascii/noise.ts

/**
 * Seeded value noise + fbm + single-layer domain warp (§3). Zero
 * dependencies. Time is the z axis — sampling a slowly increasing z is the
 * field's morph; advection is applied by the caller as an x/y offset.
 */

const PERM_SIZE = 256;

/** Deterministic permutation table from a seed (mulberry32 shuffle). */
export function buildPerm(seed: number): Uint8Array {
  let a = seed >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p = new Uint8Array(PERM_SIZE * 2);
  for (let i = 0; i < PERM_SIZE; i++) p[i] = i;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < PERM_SIZE; i++) p[PERM_SIZE + i] = p[i];
  return p;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lattice(perm: Uint8Array, x: number, y: number, z: number): number {
  return perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;
}

/** 3D value noise in [0, 1] — trilinear interpolation over a hashed lattice. */
export function valueNoise3(perm: Uint8Array, x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const w = smooth(z - zi);

  const n000 = lattice(perm, xi, yi, zi);
  const n100 = lattice(perm, xi + 1, yi, zi);
  const n010 = lattice(perm, xi, yi + 1, zi);
  const n110 = lattice(perm, xi + 1, yi + 1, zi);
  const n001 = lattice(perm, xi, yi, zi + 1);
  const n101 = lattice(perm, xi + 1, yi, zi + 1);
  const n011 = lattice(perm, xi, yi + 1, zi + 1);
  const n111 = lattice(perm, xi + 1, yi + 1, zi + 1);

  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** fbm: lacunarity 2, gain 0.5, normalized to [0, 1] (§3). */
export function fbm(perm: Uint8Array, x: number, y: number, z: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(perm, x * freq, y * freq, z * freq);
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

/**
 * Domain-warped fbm (Quílez pattern): field = fbm(p + W·(fbm(p+e₁), fbm(p+e₂))).
 * The warp turns blobs into liquid, current-like structure. octaves < 3 is
 * the mobile degradation path: plain fbm, no warp (§8).
 */
export const WARP_STRENGTH = 1.6;
const E1 = 5.2;
const E2 = 1.3;

export function warpedFbm(perm: Uint8Array, x: number, y: number, z: number, octaves: number): number {
  if (octaves < 3) return fbm(perm, x, y, z, octaves);
  const qx = fbm(perm, x + E1, y + E1, z, octaves);
  const qy = fbm(perm, x + E2, y + E2, z, octaves);
  return fbm(perm, x + WARP_STRENGTH * (qx - 0.5) * 2, y + WARP_STRENGTH * (qy - 0.5) * 2, z, octaves);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/noise.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/noise.ts tests/noise.test.ts
git commit -m "feat: seeded value noise, fbm, and domain warp for the field"
```

---

### Task 4: Pulse store (§3b-B, §3b-C)

**Files:**
- Create: `lib/ascii/pulse-store.ts`
- Test: `tests/pulse-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/pulse-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { emitClick, emitPulse, getRipples, resetRipples } from "@/lib/ascii/pulse-store";

beforeEach(() => {
  resetRipples();
});

describe("pulse store", () => {
  it("keeps at most 3 concurrent click ripples, evicting the oldest", () => {
    emitClick(0, 0, 1000);
    emitClick(10, 0, 1100);
    emitClick(20, 0, 1200);
    emitClick(30, 0, 1300);
    const clicks = getRipples(1400).filter((r) => r.kind === "click");
    expect(clicks).toHaveLength(3);
    expect(clicks.some((r) => r.x === 0)).toBe(false);
  });

  it("prunes ripples past their life", () => {
    emitPulse(0, 0, 1000);
    emitClick(0, 0, 1000);
    expect(getRipples(1901).filter((r) => r.kind === "click")).toHaveLength(0);
    expect(getRipples(3601)).toHaveLength(0);
  });

  it("pulse and click carry the spec crest amplitudes", () => {
    emitPulse(1, 2, 0);
    emitClick(3, 4, 0);
    const [pulse, click] = getRipples(1);
    expect(pulse.amp).toBe(2); // +2 ramp band (§3b-B)
    expect(click.amp).toBe(4); // crest +4 (§3b-C)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/pulse-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/ascii/pulse-store.ts`**

```ts
// lib/ascii/pulse-store.ts

/**
 * Ripple bus (§3b-B/C) — a ~20-line store in the style of scroll-store.
 * The Wordmark publishes breath pulses, pointer-down publishes click
 * ripples; the field engine consumes both each frame.
 */

export interface Ripple {
  x: number; // origin, CSS px
  y: number;
  start: number; // performance.now() ms
  amp: number; // ramp-step crest height
  life: number; // ms until fully dissipated
  kind: "pulse" | "click";
}

const MAX_CLICKS = 3;
const ripples: Ripple[] = [];

export function emitPulse(x: number, y: number, now: number): void {
  ripples.push({ x, y, start: now, amp: 2, life: 2600, kind: "pulse" });
}

export function emitClick(x: number, y: number, now: number): void {
  let clicks = 0;
  for (const r of ripples) if (r.kind === "click") clicks++;
  if (clicks >= MAX_CLICKS) {
    const oldest = ripples.findIndex((r) => r.kind === "click");
    if (oldest >= 0) ripples.splice(oldest, 1);
  }
  ripples.push({ x, y, start: now, amp: 4, life: 900, kind: "click" });
}

/** Prune expired ripples and return the live list. The engine never mutates it. */
export function getRipples(now: number): readonly Ripple[] {
  for (let i = ripples.length - 1; i >= 0; i--) {
    if (now - ripples[i].start > ripples[i].life) ripples.splice(i, 1);
  }
  return ripples;
}

export function resetRipples(): void {
  ripples.length = 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/pulse-store.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/pulse-store.ts tests/pulse-store.test.ts
git commit -m "feat: pulse store for wordmark ripples and click ripples"
```

---

### Task 5: Field math — easing, intro envelope, flow buckets (§2, §3b-A, §5)

**Files:**
- Create: `lib/ascii/field.ts` (pure helpers + constants; the engine class lands in Task 6)
- Test: `tests/field.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/field.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/field.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure half of `lib/ascii/field.ts`**

```ts
// lib/ascii/field.ts

/**
 * The living field engine (§2): every cell holds a target ramp position and
 * a current position eased toward it each frame. The intro, cursor trail,
 * ripples, erosion, and footer gravity are all modulations on the one
 * target — no separate intro engine, no mode seam.
 *
 * This module is DOM-free. AsciiGrid owns the canvas, atlas, and input
 * events and feeds the engine plain numbers.
 */

import { AMBIENT_CEIL, ATLAS_BACKSLASH, ATLAS_PIPE, FIELD_RAMP_LEN } from "@/lib/ascii/ramp";
import { buildPerm, smoothstep, warpedFbm } from "@/lib/ascii/noise";
import { clamp, erosionAlpha, type ErosionZone } from "@/lib/ascii/density";
import type { Ripple } from "@/lib/ascii/pulse-store";

// ── Tuning constants (§2, §3, §4, §5) — starting values; expect a visual pass ──

// contextual easing time constants (§2)
export const TAU_AMBIENT = 220; // ms — slow ink settling
export const TAU_TRAIL_RISE = 80; // ms — immediate response to touch
export const TAU_TRAIL_DECAY = 350; // ms — wake dissipating
export const TAU_EROSION = 400; // ms — ink receding from content
export const TAUS = [TAU_AMBIENT, TAU_TRAIL_RISE, TAU_TRAIL_DECAY, TAU_EROSION] as const;
export const TAU_CLASS_AMBIENT = 0;
export const TAU_CLASS_RISE = 1;
export const TAU_CLASS_DECAY = 2;
export const TAU_CLASS_EROSION = 3;

// ambient field (§3)
export const FEATURE_SCALE = 0.3; // feature wavelength ≈ 30% of min(vw, vh)
export const DRIFT_PX_S = 8; // diagonal advection speed
export const MORPH_PERIOD_MS = 60_000; // time-as-third-phase morph
export const CONTRAST_LO = 0.42; // smoothstep edges — emptiness lives below
export const CONTRAST_HI = 0.85;
export const HERO_FLOOR = 0.55; // ambient scale while the hero holds the viewport (§6)

// cursor wake (§4)
export const TRAIL_SAMPLES = 24;
export const TRAIL_DECAY_MS = 280;
export const TRAIL_R_SLOW = 90; // px — slow cursor draws a fine line
export const TRAIL_R_FAST = 150; // px — fast sweep drags a broad wake
export const TRAIL_MAX_LIFT = 8; // ramp steps — stirring reaches the letters
export const TRAIL_GAIN = 1.5;

// ripples (§3b-B/C)
export const RIPPLE_SPEED = 0.35; // px/ms ring expansion
export const RIPPLE_SIGMA = 30; // px gaussian band half-width
export const PULSE_REACH = 0.4; // pulses dissipate by 40% of the viewport

// footer flood (§6)
export const GRAVITY_STEPS = 12;

// intro (§5) — the total envelope matches the wordmark (RESOLVE_DONE 4800)
export const INTRO_DORMANT_END = 250;
export const INTRO_BLOOM_END = 2600;
export const INTRO_PEAK_END = 3600;
export const INTRO_RECEDE_END = 5100;
export const INTRO_CREST = 6; // ramp steps above ambient at the front line
export const INTRO_OVERSHOOT = 1.5; // ambient multiplier behind the front
export const INTRO_JITTER_MS = 60; // per-cell arrival jitter
const INTRO_FRONT_REACH = 1.35; // front travels past the corner so the crest clears
const INTRO_FRONT_SIGMA = 0.08;
const INTRO_DORMANT_MASK = 0.08; // scattered specks at alpha ≈ 0.05
const INTRO_BREATH = 0.12; // one slow synchronized breath at peak

// flow strokes (§3b-A)
export const FLOW_MIN = 3;
export const FLOW_MAX = 9;
const FLOW_EPS = 0.35; // gradient magnitude below this keeps the ramp glyph
const FLOW_BUCKET_ATLAS = [2, ATLAS_BACKSLASH, ATLAS_PIPE, 4] as const; // - \ | /

/** Per-frame easing factor for a time constant τ: 1 − e^(−dt/τ) (§2). */
export function easeFactor(dtMs: number, tau: number): number {
  return 1 - Math.exp(-dtMs / tau);
}

/** The bloom front's ease: 1 − (1 − t)^1.8, clamped (§5). */
export function bloomEase(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 1.8);
}

export interface IntroState {
  mask: number;
  crest: number;
}

/**
 * The intro as a modulation on the one pipeline (§5): `mask` multiplies the
 * ambient target, `crest` adds the traveling ink front. After the intro the
 * envelope is identically (1, 0) — the handoff is seamless by construction.
 *
 * `distNorm` is the cell's pixel distance from viewport center, normalized
 * so the farthest corner is 1. Writes into `out` — zero allocation.
 */
export function introEnvelope(
  distNorm: number,
  jitterMs: number,
  elapsed: number,
  out: IntroState,
): IntroState {
  if (elapsed >= INTRO_RECEDE_END) {
    out.mask = 1;
    out.crest = 0;
    return out;
  }
  if (elapsed < INTRO_DORMANT_END) {
    out.mask = INTRO_DORMANT_MASK;
    out.crest = 0;
    return out;
  }
  if (elapsed < INTRO_BLOOM_END) {
    const t = (elapsed + jitterMs - INTRO_DORMANT_END) / (INTRO_BLOOM_END - INTRO_DORMANT_END);
    const front = bloomEase(t) * INTRO_FRONT_REACH;
    const ignT = Math.min(1, (elapsed - INTRO_DORMANT_END) / 300);
    const ign = ignT * ignT; // soft ignition — no value jump at the dormant boundary
    const sdf = distNorm - front;
    const settled = smoothstep(0, 0.25, Math.max(0, -sdf));
    out.mask = INTRO_DORMANT_MASK + (INTRO_OVERSHOOT - INTRO_DORMANT_MASK) * settled * ign;
    out.crest = INTRO_CREST * Math.exp(-(sdf * sdf) / (2 * INTRO_FRONT_SIGMA * INTRO_FRONT_SIGMA)) * ign;
    return out;
  }
  if (elapsed < INTRO_PEAK_END) {
    const t = (elapsed - INTRO_BLOOM_END) / (INTRO_PEAK_END - INTRO_BLOOM_END);
    out.mask = INTRO_OVERSHOOT + INTRO_BREATH * Math.sin(Math.PI * t);
    out.crest = 0;
    return out;
  }
  // recede (§5): edges ease down first, center last — ink drains into the name
  const phaseT = (elapsed - INTRO_PEAK_END) / (INTRO_RECEDE_END - INTRO_PEAK_END);
  const stagger = (1 - Math.min(1, distNorm)) * 0.4;
  const cellT = clamp((phaseT - stagger) / Math.max(0.01, 1 - stagger), 0, 1);
  const s = cellT * cellT * (3 - 2 * cellT);
  out.mask = INTRO_OVERSHOOT + (1 - INTRO_OVERSHOOT) * s;
  out.crest = 0;
  return out;
}

/**
 * Flow-aligned stroke substitution (§3b-A): the atlas index of the
 * directional glyph for a local density gradient, or −1 to keep the ramp
 * glyph. Strokes run along the contour — perpendicular to the gradient.
 * Screen coordinates (y down): gradient (1,1) → "/" stroke.
 */
export function flowAtlasIndex(gx: number, gy: number): number {
  if (gx * gx + gy * gy < FLOW_EPS * FLOW_EPS) return -1;
  let a = Math.atan2(gy, gx) + Math.PI / 2;
  a %= Math.PI;
  if (a < 0) a += Math.PI;
  return FLOW_BUCKET_ATLAS[Math.round(a / (Math.PI / 4)) % 4];
}
```

(The `FieldFrameInput` interface and `FieldEngine` class are appended in Task 6 — `FIELD_RAMP_LEN`, `AMBIENT_CEIL`, `warpedFbm`, `buildPerm`, `erosionAlpha`, `ErosionZone`, and `Ripple` imports are already in place for it. If lint flags them as unused at this step, that's expected — either commit both tasks together or trim imports to what's used and re-add in Task 6. Prefer trimming: import only `ATLAS_BACKSLASH`, `ATLAS_PIPE` from ramp, `smoothstep` from noise, `clamp` from density now.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/field.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/field.ts tests/field.test.ts
git commit -m "feat: field math — contextual easing, intro envelope, flow buckets"
```

---

### Task 6: FieldEngine (§2, §3, §4, §6)

**Files:**
- Modify: `lib/ascii/field.ts` (append)
- Test: `tests/field.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/field.test.ts` (add `FieldEngine` to the import from `@/lib/ascii/field`):

```ts
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

describe("FieldEngine", () => {
  const make = () => new FieldEngine(40, 20, 7.8, 17.55, 312, 351, false);

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/field.test.ts`
Expected: FAIL — `FieldEngine` not exported.

- [ ] **Step 3: Append the engine to `lib/ascii/field.ts`**

Add the imports Task 5 deferred (final import block at the top of the file):

```ts
import { AMBIENT_CEIL, ATLAS_BACKSLASH, ATLAS_PIPE, FIELD_RAMP_LEN } from "@/lib/ascii/ramp";
import { buildPerm, smoothstep, warpedFbm } from "@/lib/ascii/noise";
import { clamp, erosionAlpha, type ErosionZone } from "@/lib/ascii/density";
import type { Ripple } from "@/lib/ascii/pulse-store";
```

Append at the end of the file:

```ts
export interface FieldFrameInput {
  now: number; // performance.now()
  introElapsed: number; // ms since mount; Infinity disables the intro
  heroDissolve: number; // scroll-store snapshot
  footerGravity: number;
  zones: readonly ErosionZone[];
  ripples: readonly Ripple[];
  scrollDrift: number; // px — scroll counter-advection offset (§3b-C)
}

export class FieldEngine {
  readonly cols: number;
  readonly rows: number;
  readonly total: number;
  readonly target: Float32Array;
  readonly current: Float32Array;

  private readonly tauClass: Uint8Array;
  private readonly jitter: Float32Array;
  private readonly distNorm: Float32Array;
  private readonly perm: Uint8Array;
  private readonly kScratch = new Float32Array(TAUS.length);
  private readonly introState: IntroState = { mask: 1, crest: 0 };

  private readonly charW: number;
  private readonly charH: number;
  private readonly vw: number;
  private readonly vh: number;
  private readonly octaves: number;
  private readonly noiseScale: number;

  // cursor trail ring buffer (§4) — all preallocated, zero per-frame allocation
  private readonly trailX = new Float32Array(TRAIL_SAMPLES);
  private readonly trailY = new Float32Array(TRAIL_SAMPLES);
  private readonly trailT = new Float32Array(TRAIL_SAMPLES);
  private readonly trailR = new Float32Array(TRAIL_SAMPLES);
  private readonly trailW = new Float32Array(TRAIL_SAMPLES); // scratch: per-pass age weights
  private trailHead = 0;

  constructor(
    cols: number,
    rows: number,
    charW: number,
    charH: number,
    vw: number,
    vh: number,
    mobile: boolean,
    seed = 1337,
  ) {
    this.cols = cols;
    this.rows = rows;
    this.total = cols * rows;
    this.charW = charW;
    this.charH = charH;
    this.vw = vw;
    this.vh = vh;
    this.octaves = mobile ? 2 : 3; // §8: mobile drops an octave and the warp
    this.noiseScale = 1 / Math.max(1, FEATURE_SCALE * Math.min(vw, vh));
    this.perm = buildPerm(seed);
    this.target = new Float32Array(this.total);
    this.current = new Float32Array(this.total);
    this.tauClass = new Uint8Array(this.total);
    this.jitter = new Float32Array(this.total);
    this.distNorm = new Float32Array(this.total);

    const cx = vw / 2;
    const cy = vh / 2;
    const corner = Math.max(1, Math.sqrt(cx * cx + cy * cy));
    for (let i = 0; i < this.total; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const px = col * charW + charW / 2 - cx;
      const py = row * charH + charH / 2 - cy;
      this.distNorm[i] = Math.sqrt(px * px + py * py) / corner;
      const h = ((col * 7919 + row * 104729) % 1000) / 1000;
      this.jitter[i] = (h - 0.5) * 2 * INTRO_JITTER_MS;
    }
    this.trailT.fill(-1e9);
  }

  /** Push a pointer sample into the trail ring buffer (§4). Radius scales with speed. */
  addTrailSample(x: number, y: number, now: number, speedPxMs: number): void {
    const i = this.trailHead;
    this.trailX[i] = x;
    this.trailY[i] = y;
    this.trailT[i] = now;
    this.trailR[i] = TRAIL_R_SLOW + Math.min(1, speedPxMs / 1.5) * (TRAIL_R_FAST - TRAIL_R_SLOW);
    this.trailHead = (i + 1) % TRAIL_SAMPLES;
  }

  /** The §2 pipeline. Runs every 2nd frame desktop / 3rd mobile (§8). */
  recomputeTargets(input: FieldFrameInput): void {
    const { now, introElapsed, heroDissolve, footerGravity, zones, ripples, scrollDrift } = input;
    const { cols, rows, charW, charH, vw, vh, octaves, noiseScale, perm } = this;

    const drift = (now / 1000) * DRIFT_PX_S * 0.7071; // diagonal advection (§3)
    const z = now / MORPH_PERIOD_MS;
    const heroScale = HERO_FLOOR + (1 - HERO_FLOOR) * heroDissolve; // §6
    const introActive = introElapsed < INTRO_RECEDE_END;
    const voidScale = footerGravity > 0.8 ? Math.max(0, 1 - (footerGravity - 0.8) / 0.2) : 1;
    const hasZones = zones.length > 0;
    const bandFade =
      heroDissolve > 0.3 && heroDissolve < 1
        ? clamp(heroDissolve < 0.5 ? (heroDissolve - 0.3) / 0.2 : 1 - (heroDissolve - 0.8) / 0.2, 0, 1)
        : 0;

    // per-sample trail weights + bounding box for this pass
    let trailMinX = Infinity;
    let trailMaxX = -Infinity;
    let trailMinY = Infinity;
    let trailMaxY = -Infinity;
    for (let s = 0; s < TRAIL_SAMPLES; s++) {
      const age = now - this.trailT[s];
      const w = age >= 0 && age < 1200 ? Math.exp(-age / TRAIL_DECAY_MS) : 0;
      this.trailW[s] = w;
      if (w > 0.01) {
        const r = this.trailR[s];
        if (this.trailX[s] - r < trailMinX) trailMinX = this.trailX[s] - r;
        if (this.trailX[s] + r > trailMaxX) trailMaxX = this.trailX[s] + r;
        if (this.trailY[s] - r < trailMinY) trailMinY = this.trailY[s] - r;
        if (this.trailY[s] + r > trailMaxY) trailMaxY = this.trailY[s] + r;
      }
    }

    const rippleCount = ripples.length;

    for (let row = 0; row < rows; row++) {
      const y = row * charH + charH / 2;
      const viewportNorm = y / vh;
      // section divider band (§6) — kept from the old field, as a ramp boost
      let rowBand = 0;
      if (bandFade > 0) {
        const distFromBand = Math.abs(viewportNorm - 0.5);
        if (distFromBand < 0.08) rowBand = (1 - distFromBand / 0.08) * bandFade;
      }
      const rowGravity = footerGravity > 0 ? footerGravity * viewportNorm * GRAVITY_STEPS : 0;

      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const x = col * charW + charW / 2;

        // §3 ambient: pixel-space domain-warped fbm, advected + morphing,
        // contrast-curved so ~half the field rests at or near space
        const n = warpedFbm(perm, (x + drift) * noiseScale, (y + drift + scrollDrift) * noiseScale, z, octaves);
        let ambient = smoothstep(CONTRAST_LO, CONTRAST_HI, n) * AMBIENT_CEIL * heroScale;

        const ero = hasZones ? erosionAlpha(x, y, vw, vh, zones) : 1;
        ambient *= ero;

        let crest = 0;
        if (introActive) {
          const intro = introEnvelope(this.distNorm[i], this.jitter[i], introElapsed, this.introState);
          ambient *= intro.mask;
          crest = intro.crest;
        }

        // §4 cursor wake (bbox-bounded)
        let trail = 0;
        if (x >= trailMinX && x <= trailMaxX && y >= trailMinY && y <= trailMaxY) {
          for (let s = 0; s < TRAIL_SAMPLES; s++) {
            const w = this.trailW[s];
            if (w < 0.01) continue;
            const dx = x - this.trailX[s];
            const dy = y - this.trailY[s];
            const r = this.trailR[s];
            const d2 = dx * dx + dy * dy;
            if (d2 > r * r) continue;
            trail += Math.exp((-d2 / (r * r)) * 3) * w;
          }
          if (trail > 0) trail = Math.min(TRAIL_MAX_LIFT, trail * TRAIL_GAIN);
        }

        // §3b ripples — wordmark pulses + click rings
        let rippleLift = 0;
        for (let p = 0; p < rippleCount; p++) {
          const rp = ripples[p];
          const age = now - rp.start;
          if (age < 0 || age > rp.life) continue;
          const radius = age * RIPPLE_SPEED;
          const fade =
            rp.kind === "pulse"
              ? Math.max(0, 1 - radius / (PULSE_REACH * Math.min(vw, vh)))
              : Math.max(0, 1 - age / rp.life);
          if (fade <= 0) continue;
          const dx = x - rp.x;
          const dy = y - rp.y;
          const dr = Math.sqrt(dx * dx + dy * dy) - radius;
          if (dr * dr > 9 * RIPPLE_SIGMA * RIPPLE_SIGMA) continue;
          rippleLift += rp.amp * Math.exp(-(dr * dr) / (2 * RIPPLE_SIGMA * RIPPLE_SIGMA)) * fade;
        }

        const band = rowBand > 0 ? rowBand * (1 - Math.abs(col / Math.max(1, cols - 1) - 0.5) * 2) * 5 : 0;

        const t = (ambient + crest + trail + rippleLift + band + rowGravity) * voidScale;
        this.target[i] = clamp(t, 0, FIELD_RAMP_LEN - 1);

        // contextual τ (§2): touch responds fastest, erosion recedes slowest
        this.tauClass[i] =
          trail > 0.3
            ? this.target[i] > this.current[i]
              ? TAU_CLASS_RISE
              : TAU_CLASS_DECAY
            : ero < 0.98
              ? TAU_CLASS_EROSION
              : TAU_CLASS_AMBIENT;
      }
    }
  }

  /** Per-frame easing pass — one multiply-add per cell (§2). */
  ease(dtMs: number): void {
    const ks = this.kScratch;
    for (let c = 0; c < TAUS.length; c++) ks[c] = easeFactor(dtMs, TAUS[c]);
    const { target, current, tauClass, total } = this;
    for (let i = 0; i < total; i++) {
      current[i] += (target[i] - current[i]) * ks[tauClass[i]];
    }
  }

  /** Snap current to target — the reduced-motion static frame (§10.5). */
  settle(): void {
    this.current.set(this.target);
  }

  /** Flow-stroke atlas index from target-grid finite differences (§3b-A). */
  flowIndexAt(i: number): number {
    const col = i % this.cols;
    const row = (i / this.cols) | 0;
    const t = this.target;
    const gx = (col < this.cols - 1 ? t[i + 1] : t[i]) - (col > 0 ? t[i - 1] : t[i]);
    const gy = (row < this.rows - 1 ? t[i + this.cols] : t[i]) - (row > 0 ? t[i - this.cols] : t[i]);
    return flowAtlasIndex(gx, gy);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: all suites PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/field.ts tests/field.test.ts
git commit -m "feat: FieldEngine — one target/current pipeline for ambient, intro, trail, ripples, gravity"
```

---

### Task 7: AsciiGrid rewrite (§6c, §7, §8)

**Files:**
- Modify: `components/ascii/AsciiGrid.tsx` (full rewrite)

- [ ] **Step 1: Replace `components/ascii/AsciiGrid.tsx` entirely**

```tsx
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
      engine: new FieldEngine(cols, rows, charW, charH, w, h, mobile),
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
```

- [ ] **Step 2: Verify it compiles and builds**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean. (`intro.ts`/`density.ts` legacy exports are now unimported but still present — deleted next task.)

- [ ] **Step 3: Verify in the browser**

```bash
pnpm dev
```

Use the playwright skill (or `playwright-cli`) against `http://localhost:3000`:
- Screenshot at ~1.5s after load: the ink bloom front should be mid-sweep, structured field visible behind it.
- Screenshot at ~7s: ambient field — 2–4 coherent structures, ~half the viewport empty, mid-density regions showing `- / \ |` strokes, **no letter glyphs** (`T A Y L 0 R`) visible.
- Move the mouse in a sweep, screenshot: a wake trail with denser characters (digits/letters) under the path.
- Click, screenshot ~300ms later: a single expanding ring.
- Scroll to the footer, screenshot: lower viewport floods dense, the very bottom resolves quiet.
- Emulate `prefers-reduced-motion: reduce`, reload: static field frame, no animation.

Report screenshots/descriptions to the user before proceeding — this is the visual checkpoint.

- [ ] **Step 4: Commit**

```bash
git add components/ascii/AsciiGrid.tsx
git commit -m "feat: rewrite AsciiGrid around the field engine — atlas coverage, wake, ripples, flow strokes"
```

---

### Task 8: Delete the legacy engine (§9)

**Files:**
- Delete: `lib/ascii/intro.ts`
- Modify: `lib/ascii/ramp.ts` (remove deprecated `RAMP`/`RAMP_LEN`)
- Modify: `lib/ascii/density.ts` (remove `breathingAlpha`/`sparkleBoost`)

- [ ] **Step 1: Delete and trim**

```bash
git rm lib/ascii/intro.ts
```

In `lib/ascii/ramp.ts`, delete the two `@deprecated` lines at the bottom (`RAMP`, `RAMP_LEN`).

In `lib/ascii/density.ts`, delete the `breathingAlpha` and `sparkleBoost` functions (keep `ErosionZone`, `erosionAlpha`, `clamp` — the geometries are unchanged per §6).

- [ ] **Step 2: Verify nothing references them**

Run: `grep -rn "breathingAlpha\|sparkleBoost\|ascii/intro\|RAMP_LEN\b" app components lib tests --include="*.ts" --include="*.tsx"`
Expected: no matches (note: `FIELD_RAMP_LEN` is fine — the grep word-boundary excludes it).

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -A lib/ascii
git commit -m "chore: delete legacy intro engine, churn helpers, and 15-step ramp"
```

---

### Task 9: Wordmark publishes its heartbeat (§3b-B)

**Files:**
- Modify: `components/hero/Wordmark.tsx`

- [ ] **Step 1: Add the pulse emission**

Add the import at the top with the other imports:

```ts
import { emitPulse } from "@/lib/ascii/pulse-store";
```

Add a ref next to `glowRef` (around line 137):

```ts
const lastPulseCycleRef = useRef(-1);
```

In `tick`, directly after the `sinceFirstWaveGlow` glow block (after `glowRef.current = newGlow;`), add:

```ts
      // §3b-B one heartbeat: each wave pulse ripples into the field while
      // the hero holds the viewport
      if (sinceFirstWaveGlow >= 0 && dp < 0.5 && !tabHidden.current) {
        const cycle = Math.floor(sinceFirstWaveGlow / WAVE_INTERVAL);
        if (cycle !== lastPulseCycleRef.current) {
          lastPulseCycleRef.current = cycle;
          const rect = wrapRef.current?.getBoundingClientRect();
          if (rect) emitPulse(rect.left + rect.width / 2, rect.top + rect.height / 2, now);
        }
      }
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

In the dev server: wait for the hero to settle (~7s), watch ~5.2s cycles — each wordmark sheen wave should be answered by a faint radial ripple expanding through the field from the mark. Subliminal, +2 ramp steps.

- [ ] **Step 3: Commit**

```bash
git add components/hero/Wordmark.tsx
git commit -m "feat: wordmark publishes breath pulses into the field"
```

---

### Task 10: One scramble language (§1, §6b)

**Files:**
- Modify: `lib/ascii/scramble.ts`
- Modify: `components/shared/HeaderDecode.tsx`

- [ ] **Step 1: Switch the default charset**

Replace the first line of `lib/ascii/scramble.ts`:

```ts
import { SCRAMBLE_CHARS } from "@/lib/ascii/ramp";
```

and change the signature default:

```ts
export function scrambleText(
  text: string,
  progress: number,
  chars: string = SCRAMBLE_CHARS,
): string {
```

Delete the old `const DEFAULT_CHARS = "·:-=+*#%";` line.

- [ ] **Step 2: Re-tune HeaderDecode**

In `components/shared/HeaderDecode.tsx`:
- Replace `const DECODE_MS = 300;` with an import-driven value and delete `DENSITY_CHARS`:

```ts
import { RESOLVE_CHAR_MS } from "@/lib/ascii/ramp";

const DECODE_MS = RESOLVE_CHAR_MS;
const TICK_MS = 28;
```

- Change the `scrambleText` call to use the default charset:

```ts
setDisplay(scrambleText(text, t));
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. In the dev server, scroll to a section header — it decodes through field characters (`: / + = > < ! ? 3 I 2 5`), not blocks.

- [ ] **Step 4: Commit**

```bash
git add lib/ascii/scramble.ts components/shared/HeaderDecode.tsx
git commit -m "feat: unify scramble charset on mid-ramp field characters"
```

---

### Task 11: Char-precision hover scramble (§6b)

**Files:**
- Create: `lib/hooks/useScrambleWalk.ts`
- Modify: `components/hero/ScrambleLink.tsx` (rewrite)
- Modify: `components/work/WorkCard.tsx` (title)

- [ ] **Step 1: Create `lib/hooks/useScrambleWalk.ts`**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { SCRAMBLE_CHARS } from "@/lib/ascii/ramp";
import { scrambleText } from "@/lib/ascii/scramble";

const WALK_MS = 1000; // out-and-back ramp walk per character (§6b)
const FOCUS_MS = 240; // keyboard focus keeps the whole-label scramble

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Char-precision hover scramble (§6b): only the characters under and
 * adjacent to the cursor (±1 cell) walk the scramble alphabet out and back
 * on an easeOutQuint triangle wave. Monospace makes hit-testing trivial.
 * Keyboard focus (no cursor to localize) scrambles the whole label.
 */
export function useScrambleWalk(text: string) {
  const [display, setDisplay] = useState(text);
  const startsRef = useRef<Float64Array>(new Float64Array(0));
  const rafRef = useRef<number | null>(null);
  const focusStartRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    startsRef.current = new Float64Array(text.length);
    setDisplay(text);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [text]);

  const frame = () => {
    const now = performance.now();
    const starts = startsRef.current;
    let active = false;
    let out = "";

    if (focusStartRef.current > 0) {
      const t = Math.min(1, (now - focusStartRef.current) / FOCUS_MS);
      out = scrambleText(text, t);
      if (t < 1) active = true;
      else focusStartRef.current = 0;
    } else {
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const s = starts[i];
        if (s === 0 || ch === " ") {
          out += ch;
          continue;
        }
        const p = (now - s) / WALK_MS;
        if (p >= 1) {
          starts[i] = 0;
          out += ch;
          continue;
        }
        active = true;
        const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
        const depth = easeOutQuint(tri);
        out +=
          depth < 0.08
            ? ch
            : SCRAMBLE_CHARS[Math.min(SCRAMBLE_CHARS.length - 1, Math.floor(depth * SCRAMBLE_CHARS.length))];
      }
    }

    setDisplay(active ? out : text);
    rafRef.current = active ? requestAnimationFrame(frame) : null;
  };

  const ensureLoop = () => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reducedRef.current || text.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const idx = Math.floor(((e.clientX - rect.left) / rect.width) * text.length);
    const now = performance.now();
    const starts = startsRef.current;
    for (let j = idx - 1; j <= idx + 1; j++) {
      if (j < 0 || j >= text.length || text[j] === " ") continue;
      // re-arm only chars past their outbound half — keeps the wave smooth
      if (starts[j] === 0 || now - starts[j] > WALK_MS / 2) starts[j] = now;
    }
    ensureLoop();
  };

  const onFocus = () => {
    if (reducedRef.current) return;
    focusStartRef.current = performance.now();
    ensureLoop();
  };

  const onBlur = () => {
    focusStartRef.current = 0;
  };

  return { display, onMouseMove, onFocus, onBlur };
}
```

- [ ] **Step 2: Rewrite `components/hero/ScrambleLink.tsx`**

```tsx
"use client";

import { type AnchorHTMLAttributes } from "react";
import { useScrambleWalk } from "@/lib/hooks/useScrambleWalk";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: string };

export function ScrambleLink({ children, onMouseMove, onFocus, onBlur, ...rest }: Props) {
  const walk = useScrambleWalk(children);

  return (
    <a
      {...rest}
      onMouseMove={(e) => {
        walk.onMouseMove(e);
        onMouseMove?.(e);
      }}
      onFocus={(e) => {
        walk.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        walk.onBlur();
        onBlur?.(e);
      }}
    >
      {walk.display}
    </a>
  );
}
```

- [ ] **Step 3: Reuse on WorkCard titles (§6b)**

In `components/work/WorkCard.tsx`, add the import:

```ts
import { useScrambleWalk } from "@/lib/hooks/useScrambleWalk";
```

In the component body (after `const reduced = useReducedMotion();`):

```ts
const titleWalk = useScrambleWalk(project.title);
```

Replace the title span (currently `{project.title}` around line 171–176) with:

```tsx
            <span
              className="font-mono text-[14px] font-medium transition-colors duration-300"
              style={{ color: dimmed ? "var(--fg-quietest)" : "var(--fg-strong)" }}
              onMouseMove={titleWalk.onMouseMove}
            >
              {titleWalk.display}
            </span>
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

Dev server: hover slowly across "selected work →" — only the 1–3 characters under the cursor walk out into field characters and back (~1s per char). Tab to the link — the whole label scrambles once. Hover a work card title — same localized effect.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/useScrambleWalk.ts components/hero/ScrambleLink.tsx components/work/WorkCard.tsx
git commit -m "feat: char-precision hover scramble on links and work titles"
```

---

### Task 12: DensityResolve on the field ramp (§6b)

**Files:**
- Modify: `components/story/DensityResolve.tsx`

- [ ] **Step 1: Re-tune**

In `components/story/DensityResolve.tsx`:

Add the import:

```ts
import { RESOLVE_CHAR_MS, RESOLVE_SWEEP_MS } from "@/lib/ascii/ramp";
```

Replace the ramp (line 7) — dense → light along the field ramp (indices 18, 14, 6, 3):

```ts
const DENSITY_RAMP = ["8", "5", "=", ":"];
```

Change the prop defaults to the shared constants:

```ts
export function DensityResolve({
  segments,
  className = "",
  stagger = RESOLVE_SWEEP_MS,
  resolveDuration = RESOLVE_CHAR_MS,
}: Props) {
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. Dev server: scroll to the story/footer — words materialize through `8 → 5 → = → :` then resolve, same physics as the field.

- [ ] **Step 3: Commit**

```bash
git add components/story/DensityResolve.tsx
git commit -m "feat: retune DensityResolve to the field ramp with shared timing"
```

---

### Task 13: Footer clock (§6b)

**Files:**
- Modify: `components/footer/Footer.tsx`

- [ ] **Step 1: Add the clock**

Add to the imports in `components/footer/Footer.tsx`:

```ts
import { useEffect, useState } from "react";
```

Add above the `Footer` component:

```tsx
const CLOCK_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// the quietest possible proof the page is alive (§6b)
function BayAreaClock() {
  const reduced = useReducedMotion();
  const [time, setTime] = useState("");

  useEffect(() => {
    setTime(CLOCK_FMT.format(new Date()));
    if (reduced) return; // static timestamp under reduced motion
    const id = setInterval(() => setTime(CLOCK_FMT.format(new Date())), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  return <span>{time || "--:--:--"}</span>;
}
```

Replace the `<span>Bay Area</span>` in the footer line with:

```tsx
          <span>
            Bay Area<span className="mx-2 text-[var(--fg-quietest)]" aria-hidden>·</span>
            <BayAreaClock />
          </span>
```

(The spec writes the line lowercase as `bay area · HH:MM:SS`; the existing footer line is title-case "Taylor Allen · 2026 · Bay Area" — keep title case for consistency with its own line. Flag to the user at review.)

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. Dev server: footer reads `Taylor Allen · 2026 · Bay Area · 18:42:07` with seconds ticking; with reduced motion emulated the timestamp renders once and holds.

- [ ] **Step 3: Commit**

```bash
git add components/footer/Footer.tsx
git commit -m "feat: live Bay Area clock in the footer"
```

---

### Task 14: Full verification + tuning pass (§10)

**Files:** none new — verification, then tuning edits to the constants block in `lib/ascii/field.ts` only if the visual pass demands it.

- [ ] **Step 1: The full gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: every suite green, build clean.

- [ ] **Step 2: Bundle budget (§10.6)**

Compare the build's "First Load JS" for `/` against the Task 1 baseline. Budget: ≤ +3KB. If over: check that `intro.ts` is gone from the bundle and look for accidental client-component bloat before negotiating the budget.

- [ ] **Step 3: Visual success criteria (§10.3) — dev server + screenshots**

Walk the checklist with the playwright skill, screenshotting each:

1. Intro: bloom (≈1.5s) → peak breath (≈3s) → recede draining into the wordmark (≈4.5s) — no visible mode seam at 5.1s.
2. At rest: 2–4 coherent drifting structures; ~half the viewport empty; no `T A Y L 0 R` glyphs ambiently.
3. Mid-density clouds read as flow-aligned strokes — currents traceable by eye.
4. Cursor sweep surfaces letters; wake dissipates in ~1s.
5. Wordmark pulse visibly ripples the field in the hero (~every 5.2s).
6. Click drops one ink ring; 4 rapid clicks → max 3 rings.
7. Scrolling drags the field (counter-advection), settling in ~1.5s.
8. Footer floods with name characters, very bottom resolves quiet.
9. Link hover scrambles only chars under the cursor; header decode + DensityResolve speak field characters; footer clock ticks.
10. Reduced motion: static frame, zero rAF after first paint (check Performance panel).
11. Mobile viewport (<768px): 15px cells, no trail on move, tap halo works, still 60fps-smooth.

- [ ] **Step 4: Performance (§10.4)**

DevTools performance trace, mid-range throttling (4× CPU): scripting per frame < 6ms during ambient scroll; no sawtooth GC (zero per-frame allocation). If the noise pass blows the budget, the §8 levers are: recompute cadence (2→3), octaves (3→2 above some cell count), `FEATURE_SCALE`.

- [ ] **Step 5: Tuning pass (expected — spec open question)**

Contrast curve thresholds, alpha ceiling (`luminance` exponent/scale), trail radii/gain, ripple sigma are starting values. Tune only inside the constants blocks, screenshot before/after for the user, re-run `pnpm test` (tests bound the invariants, not the taste).

- [ ] **Step 6: Commit any tuning + report**

```bash
git add -A
git commit -m "tune: visual pass on field constants"
```

Report to the user: screenshots, frame-time numbers, bundle delta, and the two flagged decisions (footer clock casing; vitest added).

---

## Self-review notes

- **Spec coverage:** §1 ramp/coverage (T2), §2 pipeline/taus (T5/6), §3 ambient (T3/6), §3b-A flow (T5/6/7), §3b-B pulse (T4/9), §3b-C click+scroll-drag (T4/7), §4 wake (T6/7), §5 intro (T5/6), §6 hero-scale/erosion-as-density/band/gravity/void (T6), §6b scramble/ramp-walk/clock (T10–13), §6c canvas+lattice vars (T7), §7 atlas/Monaspace/coverage/fonts.ready/15px (T7), §8 budget table (T6/7), §9 files (all), §10 criteria (tests + T14).
- **Known consistency points:** `FIELD_RAMP_LEN` used in field.ts clamp; atlas index === ramp index for ramp glyphs, 25/26 for `\`/`|`; `introEnvelope` writes into a reused `IntroState` (zero alloc); legacy exports deleted only in T8 so every commit is green.
- **Deliberately out:** TEXT/PIXEL easter egg, cursor labels, palette themes, arcade, physics collapse (spec parking lot). `TextGenerate` does not exist — not created.
