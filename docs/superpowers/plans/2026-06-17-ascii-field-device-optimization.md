# ASCII Field Device Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the living ASCII field smooth on every device — desktop, tablet, and phone — by classifying devices on capability (not viewport width) and bounding per-frame work with a cell-count budget, while keeping the settled look identical.

**Architecture:** A new pure module (`lib/ascii/profile.ts`) chooses *quality* knobs from device capability and grows the glyph cell size just enough to hold a cell-count budget. `AsciiGrid` consumes the profile for quality and branches on per-event `pointerType` for interaction (mouse wake vs. touch tap). A width-guard stops the iOS URL-bar resize storm, and an idle throttle drops the rAF work-rate when nothing is animating. The field engine's math is untouched.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Vitest, raw `requestAnimationFrame` canvas. Package manager: `pnpm`.

## Global Constraints

- **Next.js App Router only**, Server Components by default; `'use client'` only where needed. (`AsciiGrid` and `Wordmark` are already client components.)
- **TypeScript strict.** No `any`, no `// @ts-ignore`. Prefer explicit prop/return types.
- **No new dependencies.** Every dep is a perf cost.
- **No barrel files.** Import directly from each file. Use the `@/` import alias.
- **Dark-only, monochrome, Monaspace-only, ASCII-as-identity.** Do not alter the aesthetic; this work changes performance scaling only.
- **`prefers-reduced-motion` must keep working** exactly as today (single static frame, zero rAF after first paint).
- **Gates before any task is "done":** `pnpm typecheck && pnpm lint` clean. Full plan end-gate also runs `pnpm test` and `pnpm build`.
- **Commit message trailer:** end every commit message body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Cost model (for tuning, measured on this branch):** `frame_ms ≈ 1.37 + 0.000471 · cells` (desktop, dpr1, unthrottled). Cell count = `vw·vh / (0.81·fontSize²)`.

---

## File Structure

- **`lib/ascii/profile.ts`** — *new, pure, DOM-free.* `FieldProfile`/`DetectEnv` types, `detectProfile(env)`, `chooseCellMetrics(vw, vh, profile)`. Unit-tested.
- **`lib/ascii/profile-client.ts`** — *new, DOM-only.* `readDetectEnv()` / `readProfile()` wrappers that read `matchMedia`/`navigator`. Kept separate so `profile.ts` stays testable. Not unit-tested.
- **`tests/profile.test.ts`** — *new.* Unit tests for the two pure functions.
- **`lib/ascii/field.ts`** — *modify.* `FieldEngine` constructor takes `octaves: number` instead of `mobile: boolean`. No math change.
- **`tests/field.test.ts`** — *modify.* Update the one constructor call (`false` → `3`).
- **`components/ascii/AsciiGrid.tsx`** — *modify.* Profile-driven `resize()`, pointer-type interaction, loop cadence from profile, iOS resize width-guard, idle throttle.
- **`components/hero/Wordmark.tsx`** — *modify.* Use the shared profile `lowPowerHint` for its 30fps wave-loop cap.

---

## Task 1: Pure `detectProfile` + types

**Files:**
- Create: `lib/ascii/profile.ts`
- Test: `tests/profile.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ProfileName = "desktop" | "tablet" | "handheld"`
  - `interface FieldProfile { name: ProfileName; baseCellPx: number; dprCap: number; octaves: number; recomputeEvery: number; cellBudget: number; lowPowerHint: boolean }`
  - `interface DetectEnv { pointerCoarse: boolean; hover: boolean; cores?: number; deviceMemory?: number; vw: number; vh: number }`
  - `function detectProfile(env: DetectEnv): FieldProfile`

- [ ] **Step 1: Write the failing test**

Create `tests/profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectProfile, type DetectEnv } from "@/lib/ascii/profile";

const desktopEnv: DetectEnv = { pointerCoarse: false, hover: true, vw: 1440, vh: 900 };
const coarse = (over: Partial<DetectEnv>): DetectEnv => ({
  pointerCoarse: true, hover: false, vw: 1024, vh: 1366, ...over,
});

describe("detectProfile", () => {
  it("fine pointer with hover → desktop", () => {
    expect(detectProfile(desktopEnv).name).toBe("desktop");
  });
  it("coarse pointer, large short side → tablet", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366 })).name).toBe("tablet");
  });
  it("coarse pointer, small short side → handheld", () => {
    expect(detectProfile(coarse({ vw: 390, vh: 844 })).name).toBe("handheld");
  });
  it("landscape phone (short side < 520) → handheld, not tablet", () => {
    expect(detectProfile(coarse({ vw: 932, vh: 430 })).name).toBe("handheld");
  });
  it("weak tablet (≤4 cores) demotes to handheld", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366, cores: 4 })).name).toBe("handheld");
  });
  it("desktop is never demoted by low cores (keeps the warp)", () => {
    expect(detectProfile({ ...desktopEnv, cores: 2 }).name).toBe("desktop");
    expect(detectProfile({ ...desktopEnv, cores: 2 }).octaves).toBeGreaterThanOrEqual(3);
  });
  it("missing power hints are never required", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366 })).name).toBe("tablet");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/profile.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ascii/profile"` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `lib/ascii/profile.ts`:

```ts
// lib/ascii/profile.ts
//
// Device-capability classification for the ASCII field. Pure and DOM-free:
// the caller reads matchMedia/navigator and passes plain values in, so these
// functions are unit-testable. This module chooses *quality* knobs only — the
// interaction model (mouse vs touch) is decided per-event by pointerType,
// never here.

export type ProfileName = "desktop" | "tablet" | "handheld";

export interface FieldProfile {
  name: ProfileName;
  baseCellPx: number; // base font size (px) before cell-budget growth
  dprCap: number; // device-pixel-ratio ceiling
  octaves: number; // fbm octaves; domain warp engages only at >= 3
  recomputeEvery: number; // run the expensive target pass every Nth frame
  cellBudget: number; // max cols*rows; cell size grows to hold this
  lowPowerHint: boolean; // consumers cap secondary rAF loops (e.g. wordmark 30fps)
}

export interface DetectEnv {
  pointerCoarse: boolean; // matchMedia('(pointer: coarse)') — the PRIMARY pointer
  hover: boolean; // matchMedia('(hover: hover)')
  cores?: number; // navigator.hardwareConcurrency (may be undefined)
  deviceMemory?: number; // navigator.deviceMemory (Chromium only; may be undefined)
  vw: number;
  vh: number;
}

const DESKTOP: FieldProfile = {
  name: "desktop", baseCellPx: 13, dprCap: 2, octaves: 3,
  recomputeEvery: 2, cellBudget: 16000, lowPowerHint: false,
};
const TABLET: FieldProfile = {
  name: "tablet", baseCellPx: 14, dprCap: 2, octaves: 2,
  recomputeEvery: 3, cellBudget: 11000, lowPowerHint: true,
};
const HANDHELD: FieldProfile = {
  name: "handheld", baseCellPx: 15, dprCap: 1.5, octaves: 2,
  recomputeEvery: 3, cellBudget: 4000, lowPowerHint: true,
};

const HANDHELD_MAX_SHORT_SIDE = 520; // px; a coarse pointer below this is a phone

/**
 * Choose the quality profile from device capability. A coarse primary pointer
 * (or no hover) means touch-first → tablet or handheld by viewport short side.
 * Power hints only ever DEMOTE a coarse tier (tablet→handheld); desktop is
 * never demoted, because the domain warp is part of the brand and the cell
 * budget already bounds its cost.
 */
export function detectProfile(env: DetectEnv): FieldProfile {
  const touchPrimary = env.pointerCoarse || !env.hover;
  let profile: FieldProfile;
  if (!touchPrimary) {
    profile = DESKTOP;
  } else {
    const shortSide = Math.min(env.vw, env.vh);
    profile = shortSide < HANDHELD_MAX_SHORT_SIDE ? HANDHELD : TABLET;
  }

  const weak =
    (env.cores !== undefined && env.cores <= 4) ||
    (env.deviceMemory !== undefined && env.deviceMemory <= 4);
  if (weak && profile.name === "tablet") return HANDHELD;
  return profile;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/profile.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/profile.ts tests/profile.test.ts
git commit -m "feat: capability-based field profile detection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Cell-budget metrics

**Files:**
- Modify: `lib/ascii/profile.ts`
- Test: `tests/profile.test.ts`

**Interfaces:**
- Consumes: `FieldProfile` (Task 1).
- Produces: `function chooseCellMetrics(vw: number, vh: number, profile: FieldProfile): { fontSize: number; charW: number; charH: number }`

- [ ] **Step 1: Write the failing test**

Append to `tests/profile.test.ts`:

```ts
import { chooseCellMetrics } from "@/lib/ascii/profile";

describe("chooseCellMetrics", () => {
  const desktop = detectProfile(desktopEnv);
  const handheld = detectProfile(coarse({ vw: 390, vh: 844 }));
  const cellsFor = (vw: number, vh: number, p = desktop) => {
    const m = chooseCellMetrics(vw, vh, p);
    return Math.ceil(vw / m.charW) * Math.ceil(vh / m.charH);
  };

  it("laptop keeps the base cell size (unchanged look)", () => {
    expect(chooseCellMetrics(1440, 900, desktop).fontSize).toBe(desktop.baseCellPx);
  });
  it("phone keeps the base cell size (unchanged look)", () => {
    expect(chooseCellMetrics(390, 844, handheld).fontSize).toBe(handheld.baseCellPx);
  });
  it("2560 monitor caps cells at or under the desktop budget", () => {
    expect(chooseCellMetrics(2560, 1440, desktop).fontSize).toBeGreaterThan(desktop.baseCellPx);
    expect(cellsFor(2560, 1440)).toBeLessThanOrEqual(desktop.cellBudget);
  });
  it("4K caps cells at or under the desktop budget", () => {
    expect(cellsFor(3840, 2160)).toBeLessThanOrEqual(desktop.cellBudget);
  });
  it("never grows past FONT_MAX (32)", () => {
    expect(chooseCellMetrics(7680, 4320, desktop).fontSize).toBeLessThanOrEqual(32);
  });
  it("charW/charH track fontSize (0.6 / 1.35)", () => {
    const m = chooseCellMetrics(2560, 1440, desktop);
    expect(m.charW).toBeCloseTo(m.fontSize * 0.6);
    expect(m.charH).toBeCloseTo(m.fontSize * 1.35);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/profile.test.ts`
Expected: FAIL — `chooseCellMetrics is not a function` / import unresolved.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/ascii/profile.ts`:

```ts
const FONT_MAX = 32; // px; clamp so absurd displays don't grow glyphs without bound
const CELL_ASPECT = 0.6 * 1.35; // charW = fontSize*0.6, charH = fontSize*1.35 → 0.81

/**
 * Grow the glyph cell size just enough to keep cols*rows <= profile.cellBudget.
 * On normal viewports returns the base size unchanged (laptop/phone identical);
 * on large viewports the cells grow, staying crisp and on the shared lattice.
 */
export function chooseCellMetrics(
  vw: number,
  vh: number,
  profile: FieldProfile,
): { fontSize: number; charW: number; charH: number } {
  const needed = Math.ceil(Math.sqrt((vw * vh) / (CELL_ASPECT * profile.cellBudget)));
  const fontSize = Math.min(FONT_MAX, Math.max(profile.baseCellPx, needed));
  return { fontSize, charW: fontSize * 0.6, charH: fontSize * 1.35 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/profile.test.ts`
Expected: PASS (13 tests total).

- [ ] **Step 5: Commit**

```bash
git add lib/ascii/profile.ts tests/profile.test.ts
git commit -m "feat: cell-count budget metrics for the field

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `FieldEngine` takes `octaves` instead of `mobile`

**Files:**
- Modify: `lib/ascii/field.ts:197-236` (constructor)
- Modify: `tests/field.test.ts:113`
- Modify: `components/ascii/AsciiGrid.tsx:118` (keep build green; replaced by profile in Task 4)

**Interfaces:**
- Consumes: nothing new.
- Produces: `new FieldEngine(cols, rows, charW, charH, vw, vh, octaves, seed?)` — 7th param is now `octaves: number` (3 = desktop+warp, 2 = light).

- [ ] **Step 1: Change the constructor signature**

In `lib/ascii/field.ts`, change the constructor parameter list (currently `mobile: boolean,`) and the octaves assignment.

Replace:
```ts
    vw: number,
    vh: number,
    mobile: boolean,
    seed = 1337,
  ) {
```
with:
```ts
    vw: number,
    vh: number,
    octaves: number,
    seed = 1337,
  ) {
```

Replace:
```ts
    this.octaves = mobile ? 2 : 3; // §8: mobile drops an octave and the warp
```
with:
```ts
    this.octaves = octaves; // 3 = desktop (warp on, see noise.ts); 2 = light
```

- [ ] **Step 2: Update the two call sites**

In `tests/field.test.ts:113`, replace `false` with `3`:
```ts
  const make = () => new FieldEngine(40, 20, 7.8, 17.55, 312, 351, 3);
```

In `components/ascii/AsciiGrid.tsx:118`, replace the temporary `mobile` arg (this line is rewritten in Task 4):
```ts
      engine: new FieldEngine(cols, rows, charW, charH, w, h, mobile ? 2 : 3),
```

- [ ] **Step 3: Run the engine tests + typecheck to verify green**

Run: `pnpm vitest run tests/field.test.ts && pnpm typecheck`
Expected: PASS (all field tests, including "roughly half the field rests at or near space" which depends on octaves=3/warp), and typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add lib/ascii/field.ts tests/field.test.ts components/ascii/AsciiGrid.tsx
git commit -m "refactor: FieldEngine takes octaves instead of a mobile flag

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: AsciiGrid uses the profile (quality + interaction)

**Files:**
- Create: `lib/ascii/profile-client.ts`
- Modify: `components/ascii/AsciiGrid.tsx` (imports, remove `fontSizeFor` + `LINE_HEIGHT`, `GridState`, `resize()`, loop cadence, both pointer handlers)

**Interfaces:**
- Consumes: `chooseCellMetrics`, `FieldProfile`, `detectProfile` (Tasks 1–2); `FieldEngine(octaves)` (Task 3).
- Produces: `readDetectEnv()`, `readProfile()` in `profile-client.ts`; `GridState.profile: FieldProfile` (replaces `GridState.mobile`).

- [ ] **Step 1: Create the DOM wrapper**

Create `lib/ascii/profile-client.ts`:

```ts
// lib/ascii/profile-client.ts
//
// DOM-reading wrapper around the pure detectProfile (kept separate so
// profile.ts stays unit-testable). Effect-time only — never call during SSR.

import { detectProfile, type DetectEnv, type FieldProfile } from "@/lib/ascii/profile";

export function readDetectEnv(): DetectEnv {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    pointerCoarse: window.matchMedia("(pointer: coarse)").matches,
    hover: window.matchMedia("(hover: hover)").matches,
    cores: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}

export function readProfile(): FieldProfile {
  return detectProfile(readDetectEnv());
}
```

- [ ] **Step 2: Update AsciiGrid imports and delete the width helpers**

In `components/ascii/AsciiGrid.tsx`, add to the imports block:
```ts
import { chooseCellMetrics, type FieldProfile } from "@/lib/ascii/profile";
import { readProfile } from "@/lib/ascii/profile-client";
```

Delete the now-unused constant and function (lines ~10 and ~17-19):
```ts
const LINE_HEIGHT = 1.35;
```
and
```ts
function fontSizeFor(w: number): number {
  return w < 768 ? 15 : 13; // §7 mobile cell-size increase
}
```

- [ ] **Step 3: Replace `mobile` with `profile` in `GridState`**

In the `GridState` interface, replace:
```ts
  mobile: boolean;
```
with:
```ts
  profile: FieldProfile;
```

- [ ] **Step 4: Rewrite `resize()` to use the profile**

Replace the entire body of the `resize` callback with:

```ts
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const profile = readProfile();
    const dpr = Math.min(profile.dprCap, window.devicePixelRatio || 1);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const { fontSize, charW, charH } = chooseCellMetrics(w, h, profile);
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);

    // grid discipline (§6c): DOM content and field cells share one lattice
    document.documentElement.style.setProperty("--ascii-cols", String(cols));
    document.documentElement.style.setProperty("--ascii-rows", String(rows));
    document.documentElement.style.setProperty("--ascii-ch", `${charW}px`);
    document.documentElement.style.setProperty("--ascii-line", `${charH}px`);

    const prev = stateRef.current;
    stateRef.current = {
      engine: new FieldEngine(cols, rows, charW, charH, w, h, profile.octaves),
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
      profile,
      lastPX: prev?.lastPX ?? -1e9,
      lastPY: prev?.lastPY ?? -1e9,
      lastPT: prev?.lastPT ?? 0,
      scrollDrift: prev?.scrollDrift ?? 0,
      lastScrollY: window.scrollY,
    };
  }, []);
```

- [ ] **Step 5: Update the loop cadence**

In the `loop` function, replace:
```ts
      if (s.frame % (s.mobile ? 3 : 2) === 0) recompute(now);
```
with:
```ts
      if (s.frame % s.profile.recomputeEvery === 0) recompute(now);
```

- [ ] **Step 6: Branch the pointer handlers on `pointerType`**

Replace `onPointerMove` with:
```ts
    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || e.pointerType !== "mouse") return; // mouse wake only; touch-move is scroll
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
```

Replace `onPointerDown` with:
```ts
    const onPointerDown = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const now = performance.now();
      s.lastPX = e.clientX;
      s.lastPY = e.clientY;
      s.lastPT = now;
      if (e.pointerType === "mouse") {
        emitClick(e.clientX, e.clientY, now); // §3b-C: touch the ink
      } else {
        s.engine.addTrailSample(e.clientX, e.clientY, now, 0); // touch/pen tap halo (§4)
      }
    };
```

- [ ] **Step 7: Verify build, types, lint, existing tests**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: all clean / pass. No remaining references to `s.mobile`, `fontSizeFor`, or `LINE_HEIGHT` (grep to confirm: `grep -n "mobile\|fontSizeFor\|LINE_HEIGHT" components/ascii/AsciiGrid.tsx` returns nothing).

- [ ] **Step 8: Manual smoke check (desktop)**

The prod server is on `:3100` (rebuild if needed: `pnpm build && PORT=3100 pnpm start`). Load `http://localhost:3100` in a normal desktop window. Expect: intro bloom → settled field, cursor wake on mouse-move, click ripple on click — identical to before.

- [ ] **Step 9: Commit**

```bash
git add lib/ascii/profile-client.ts components/ascii/AsciiGrid.tsx
git commit -m "feat: field uses capability profile + pointer-type interaction

Caps cells on large viewports; makes touch devices (iPad, landscape
phones) interactive via per-event pointerType instead of a width flag.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: iOS resize width-guard

**Files:**
- Modify: `components/ascii/AsciiGrid.tsx` (`GridState`, `resize()` assignment, `onResize`)

**Interfaces:**
- Consumes: `GridState.profile`, `GridState.dpr` (Task 4).
- Produces: `GridState.lastW: number` (the viewport width of the last full build).

- [ ] **Step 1: Add `lastW` to `GridState`**

In the `GridState` interface, add after `profile: FieldProfile;`:
```ts
  lastW: number;
```

- [ ] **Step 2: Record `lastW` in `resize()`**

In the `stateRef.current = { ... }` object literal inside `resize()`, add (next to `scrollDrift`/`lastScrollY`):
```ts
      lastW: w,
```

- [ ] **Step 3: Guard `onResize` against height-only changes**

Replace the `onResize` function with:
```ts
    let resizeTimer: number | undefined;
    const onResize = () => {
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = undefined;
        const s = stateRef.current;
        const w = window.innerWidth;
        const dprNow = Math.min(s ? s.profile.dprCap : 2, window.devicePixelRatio || 1);
        // iOS Safari fires resize when the URL bar shows/hides — a height-only
        // change. Rebuilding (new engine + atlas) mid-scroll causes jank and a
        // visible field reset, so rebuild only when width or DPR actually
        // changes. A height-only delta is ignored; the canvas keeps its size
        // (a faint unfilled strip at the very bottom when the toolbar collapses
        // is imperceptible at the field's opacity).
        if (s && w === s.lastW && dprNow === s.dpr) return;
        resize();
        if (reduced) staticFrame();
      }, 150);
    };
```

(Delete the old `let resizeTimer ...` + `onResize` block this replaces — keep only this one.)

- [ ] **Step 4: Verify build + types + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Manual check (DevTools device emulation)**

In Chrome DevTools, emulate an iPhone and toggle the "show/hide" of the address bar by scrolling, or resize height only via the device toolbar. Expect: no field flash/reset on height-only change; rotating (width change) does rebuild. Width changes still rebuild correctly on desktop.

- [ ] **Step 6: Commit**

```bash
git add components/ascii/AsciiGrid.tsx
git commit -m "fix: ignore height-only resizes (iOS URL-bar) in the field

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Idle throttle

**Files:**
- Modify: `components/ascii/AsciiGrid.tsx` (import `INTRO_RECEDE_END`, add idle constants, rewrite `loop`)

**Interfaces:**
- Consumes: `getSnapshot` (scroll-store), `getRipples` (pulse-store), `erosionZones` (SectionWrapper), `INTRO_RECEDE_END` (field.ts), `GridState` fields from Tasks 4–5.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Import `INTRO_RECEDE_END`**

In `components/ascii/AsciiGrid.tsx`, extend the field import:
```ts
import { FieldEngine, FLOW_MAX, FLOW_MIN, INTRO_RECEDE_END } from "@/lib/ascii/field";
```

- [ ] **Step 2: Add idle constants**

Near the other module constants at the top of the file (below the `SCROLL_DRIFT_*` group), add:
```ts
// §idle: when nothing is animating, drop work to ~15fps (the ambient morph
// period is 60s — imperceptible) to save battery/thermal. Any input wakes it
// the same frame, because scroll/pointer state is read before the idle gate.
const IDLE_FRAME_MS = 1000 / 15;
const SCROLL_DRIFT_EPS = 0.5;
```

- [ ] **Step 3: Rewrite the `loop` function**

Replace the entire `loop` function with:
```ts
    const loop = (now: number) => {
      const s = stateRef.current;
      if (!s || s.paused) return;
      const dt = Math.min(100, Math.max(0.01, now - s.lastFrame));

      // §3b-C: scrolling reads as moving through the medium (every frame, so
      // a scroll wakes the field instantly even from the idle state)
      const sy = window.scrollY;
      const dScroll = sy - s.lastScrollY;
      s.lastScrollY = sy;
      s.scrollDrift = Math.max(
        -SCROLL_DRIFT_CAP,
        Math.min(SCROLL_DRIFT_CAP, s.scrollDrift + dScroll * SCROLL_DRIFT_GAIN),
      );
      s.scrollDrift *= Math.exp(-dt / SCROLL_DRIFT_TAU);

      const scroll = getSnapshot();
      const active =
        now - s.mountTime < INTRO_RECEDE_END ||
        dScroll !== 0 ||
        Math.abs(s.scrollDrift) > SCROLL_DRIFT_EPS ||
        (scroll.heroDissolve > 0 && scroll.heroDissolve < 1) ||
        scroll.footerGravity > 0 ||
        (s.lastPX > -1e8 && now - s.lastPT < 1200) ||
        getRipples(now).length > 0 ||
        erosionZones.some((z) => z.progress > 0 && z.progress < 1);

      // idle: keep the rAF alive but only do work every IDLE_FRAME_MS
      if (!active && now - s.lastFrame < IDLE_FRAME_MS) {
        s.raf = requestAnimationFrame(loop);
        return;
      }

      s.lastFrame = now;
      s.frame++;

      // §8: expensive target pass at the profile cadence, easing + draw per work-frame
      if (s.frame % s.profile.recomputeEvery === 0) recompute(now);
      s.engine.ease(dt);
      drawFrame();
      s.raf = requestAnimationFrame(loop);
    };
```

(Note: this moves the scroll-drift block into `loop` and removes the old standalone copy — confirm there is exactly one scroll-drift block after editing.)

- [ ] **Step 4: Verify build, types, lint, tests**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: clean / pass.

- [ ] **Step 5: Measure idle vs. active (the throttle works and wakes instantly)**

Rebuild + serve if needed (`pnpm build && PORT=3100 pnpm start`). With the page loaded and settled, scrolled to the bottom (hero out of view, no input), run this in the DevTools console (or via chrome-devtools `evaluate_script`) and confirm idle fps ≈ 15 and that moving the mouse immediately returns to full rate:
```js
(async () => {
  const s = []; let last = performance.now(); const start = last;
  await new Promise(r => { const t = n => { s.push(n - last); last = n; (n - start >= 3000) ? r() : requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const n = s.length, sum = s.reduce((a,b)=>a+b,0);
  return { idleFps: +(1000*n/sum).toFixed(1) };
})();
```
Expected: `idleFps` ≈ 14–16 when idle at the bottom; ≈ display rate while scrolling/moving the mouse.

- [ ] **Step 6: Commit**

```bash
git add components/ascii/AsciiGrid.tsx
git commit -m "perf: idle-throttle the field to 15fps when nothing animates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Wordmark uses the shared profile

**Files:**
- Modify: `components/hero/Wordmark.tsx` (import, line ~204-210)

**Interfaces:**
- Consumes: `readProfile()` (Task 4).
- Produces: nothing.

- [ ] **Step 1: Add the import**

In `components/hero/Wordmark.tsx`, add to the imports:
```ts
import { readProfile } from "@/lib/ascii/profile-client";
```

- [ ] **Step 2: Replace the width check with the profile hint**

Replace:
```ts
    // Mobile: cap at 30fps by skipping every other frame
    const isMobile = window.innerWidth < 768;
    let frameSkip = false;
```
with:
```ts
    // Low-power devices: cap the wave loop at 30fps by skipping every other frame
    const isLowPower = readProfile().lowPowerHint;
    let frameSkip = false;
```

And replace the usage:
```ts
      // 30fps cap on mobile
      if (isMobile) {
```
with:
```ts
      // 30fps cap on low-power devices
      if (isLowPower) {
```

- [ ] **Step 3: Verify build, types, lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. Confirm no `isMobile` / `innerWidth` references remain in `Wordmark.tsx` (`grep -n "isMobile\|innerWidth" components/hero/Wordmark.tsx` → nothing).

- [ ] **Step 4: Commit**

```bash
git add components/hero/Wordmark.tsx
git commit -m "refactor: wordmark fps cap uses the shared field profile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Re-measure, visual-validate, pin budgets, final gates

**Files:**
- Possibly modify: `lib/ascii/profile.ts` (only if a budget constant needs tuning) + `tests/profile.test.ts` (if budgets change)

**Interfaces:**
- Consumes: everything above.
- Produces: confirmed perf targets; pinned budget constants.

- [ ] **Step 1: Production build + serve**

Run: `pnpm build && PORT=3100 pnpm start`
Expected: build clean. Note the first-load JS — must stay ≤ ~158.3 KB gz.

- [ ] **Step 2: Re-measure the matrix**

Using Chrome DevTools (chrome-devtools MCP `emulate` + `evaluate_script`, or manual device emulation + console), run this probe in each scenario after the intro settles (~6s):
```js
(async () => {
  await new Promise(r=>setTimeout(r,5800));
  const cs = getComputedStyle(document.documentElement);
  const cols=+cs.getPropertyValue('--ascii-cols'), rows=+cs.getPropertyValue('--ascii-rows');
  const f=[]; let last=performance.now(); const start=last;
  await new Promise(r=>{const t=n=>{f.push(n-last);last=n;(n-start>=5000)?r():requestAnimationFrame(t);};requestAnimationFrame(t);});
  f.shift(); f.sort((a,b)=>a-b); const n=f.length,sum=f.reduce((a,b)=>a+b,0);
  return { cols, rows, cells: cols*rows, fps:+(1000*n/sum).toFixed(1), mean:+(sum/n).toFixed(2),
           p95:+f[Math.floor(n*0.95)].toFixed(2), over20:f.filter(x=>x>20).length };
})();
```
Scenarios + **targets** (emulate each, then reload, then probe):
  - `1440x900x2` (no throttle) → unchanged, ~100fps, ~9.6k cells.
  - `2560x1440x1` (no throttle) → **≥ 90fps**, cells ≤ 16k.
  - `3840x2160x1` (no throttle) → **≥ 60fps**, cells ≤ 16k.
  - `1024x1366x2,touch` + CPU 3× → **≥ 60fps** (tablet profile) and a tap produces a halo.
  - `390x844x3,mobile,touch` + CPU 4–6× → unchanged (~100fps).
  - `932x430x3,mobile,touch,landscape` + CPU 6× → handheld profile (lighter than before).

- [ ] **Step 3: Visual validation (the 4K glyph-size unknown)**

Take screenshots at `1440x900`, `2560x1440`, and `3840x2160` (chrome-devtools `take_screenshot`, or manual). Confirm the larger-glyph field still reads as the same atmospheric ASCII field and looks deliberate — not coarse or sparse. The 4K glyph is ~26px; if it looks wrong, raise `cellBudget` for `desktop` toward `20000` (smaller glyphs, more cells, still ≥ 60fps on 4K per the cost model) and re-run Step 2. Update the `chooseCellMetrics` budget tests if the constant changes.

- [ ] **Step 4: Confirm reduced-motion still correct**

Emulate `prefers-reduced-motion: reduce` (DevTools Rendering tab). Expect: a single static field frame, zero ongoing rAF work (the probe's `fps` will reflect only the bare rAF, no field churn), scroll unlocked.

- [ ] **Step 5: Full end-gate**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`
Expected: all clean / pass; 50 tests pass (37 engine + 13 profile); first-load JS ≤ 158.3 KB gz.

- [ ] **Step 6: Commit any tuning + a verification note**

```bash
git add -A
git commit -m "test: pin field cell budgets against re-measured device matrix

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(If no constant changed, this commit only records updated measurements in the PR description — skip if there is nothing to commit.)

---

## Self-Review

**Spec coverage:**
- Capability profiles replacing width → Tasks 1, 4, 7. ✓
- Cell-count budget → Task 2, applied in Task 4, validated in Task 8. ✓
- Pointer-type interaction (iPad/landscape interactive) → Task 4. ✓
- iOS resize hardening → Task 5. ✓
- Idle throttle → Task 6. ✓
- Wordmark alignment → Task 7. ✓
- Engine `octaves` decoupling → Task 3. ✓
- Verification matrix + visual + gates + reduced-motion → Task 8. ✓
- Out-of-scope items (governor, forced reflow, substrate prerender) → not in any task, as intended. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. The one conditional ("if 4K looks wrong, raise budget toward 20000") is an explicit, bounded tuning instruction with a concrete value, not a placeholder.

**Type consistency:** `FieldProfile`/`DetectEnv` field names match across `profile.ts`, `profile-client.ts`, `GridState`, and consumers. `detectProfile`/`chooseCellMetrics`/`readProfile`/`readDetectEnv` names are consistent everywhere used. `FieldEngine` 7th param is `octaves: number` in field.ts and both call sites (Task 3) and the Task-4 rewrite. `recomputeEvery`/`dprCap`/`octaves`/`cellBudget`/`lowPowerHint` used consistently.
