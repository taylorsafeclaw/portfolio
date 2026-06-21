# ASCII Field — Device Optimization Design Spec

**Date:** 2026-06-17
**Branch:** `living-ascii-field` (PR #10)
**Status:** Approved design — ready for implementation plan
**Scope decision:** "Profiles + idle throttle" tier (capability profiles, cell-count budget, pointer-type interaction, iOS-resize hardening, idle throttle). The full runtime frame-time *governor* is explicitly **out of scope** for this pass.

---

## Goal

Keep the living ASCII field exactly as beautiful as it is, while making it smooth on desktop and mobile **respectively** — i.e. tuned per device class rather than per viewport width. The settled look, the engine math, the intro, and every micro-interaction stay as-is. This work changes *where the per-frame work scales* and *how devices are classified*, nothing about the aesthetic.

Non-negotiables carried from `CLAUDE.md` / the interactive-resume spec: dark-only, monochrome, Monaspace-only, ASCII-as-identity, performance-is-part-of-the-design, `prefers-reduced-motion` respected everywhere.

---

## Evidence (measured, not assumed)

Measured against the **production build** (`next start`), intro settled, steady ambient, using an in-page rAF probe (frame-time distribution + long-task observer + exact cell counts read from the engine's own `--ascii-cols`/`--ascii-rows` CSS vars). Mobile/tablet scenarios were CPU-throttled to emulate real silicon. Host Chrome runs at 100Hz, so the smoothness signal is *frames slower than ~10ms* and dropped-frame counts, not the absolute fps ceiling.

| Device / viewport | Cells | fps | mean | frames >20ms | Verdict |
|---|---|---|---|---|---|
| Laptop 1440×900 (dpr2) | 9,620 | 100 | 10.0ms | 0% | ✅ flawless |
| Monitor 2560×1440 (dpr1) | 27,307 | 70 | 14.2ms | 12% | ⚠️ drops, *ambient* |
| 4K 3840×2160 (dpr1) | 61,132 | 33 | 30.2ms | ~100% | ❌ choppy |
| iPad Pro 1024×1366 (dpr2, 3× cpu) | 10,296 | 54 | 18.6ms | 30% | ❌ choppy **and** touch-inert |
| Phone portrait 390×844 (dpr3, 4–6× cpu) | 1,848 | 100 | 10.0ms | 0% (scroll ~5%) | ✅ well-tuned |
| Phone landscape 932×430 (dpr3, 6× cpu) | 3,000 | 89 | 11.2ms | ~4% | ⚠️ heavy *desktop* pipeline + touch-inert |

**Derived cost model (desktop, dpr1, unthrottled):** `frame_ms ≈ 1.37 + 0.000471 · cells`. Cost scales dead-linearly with cell count; cursor wake adds little (bbox-bounded). A DevTools trace at 2560 showed CLS 0 and only a minor `ForcedReflow` (~159ms total, concentrated in intro/font-load startup, **not** steady-state — `SectionWrapper` reads layout on scroll only, not per frame). The forced reflow is therefore **not** addressed in this pass.

### Two root causes explain every failure

1. **No cell-count budget.** Cell size is fixed (`charW = fontSize·0.6`, `fontSize` = 13 desktop / 15 mobile). Cells = `vw·vh / (0.81·fontSize²)`, uncapped → cost grows linearly with screen area. The most common real-world desktop setup (an external 2560 monitor) already drops 12% of frames at ambient; 4K collapses to 33fps.

2. **One detection axis: `innerWidth < 768`.** This single check (`AsciiGrid.tsx:96`, `Wordmark.tsx:205`) drives cell size, DPR cap, recompute cadence, the noise pipeline (`field.ts:214` `octaves = mobile?2:3`), *and* the entire interaction model. Consequences:
   - iPads & landscape phones (width ≥ 768, touch-only) get the **heavy desktop pipeline** on weak silicon.
   - …and a **completely inert field**: `onPointerMove` bails when `pointerType !== "mouse"` (`AsciiGrid.tsx:230`); `onPointerDown` only ripples for mouse (`:246`). Touch does nothing.
   - iOS Safari URL-bar show/hide changes `innerHeight` mid-scroll → fires `resize` → `onResize` (`:272`) does a **full engine + atlas rebuild** (reallocates every typed array, redraws + re-measures the 25-glyph atlas). Repeated mid-scroll → jank + a visible field reset. (Code-confirmed; not reproducible in desktop-Chrome emulation, which has no dynamic toolbar.)

**The engine itself is excellent** — mobile portrait is flawless even at 6× throttle. No rewrite; targeted changes only.

---

## Design

### Principle

Decouple the two concerns `innerWidth < 768` conflates:
- **Quality knobs** (cell size, DPR cap, octaves/warp, recompute cadence, cell budget) ← driven by device **power**, inferred from the *primary pointer* + hardware hints, then bounded by the **cell budget**.
- **Interaction model** (mouse wake/ripple vs. touch tap/drag-wake) ← driven by the **per-event `pointerType`**, not by device class at all.

This split elegantly handles hybrids (a touch laptop gets desktop quality *and* both mouse + touch interactions, because interaction is decided per event).

### 1. New module: `lib/ascii/profile.ts` (pure, DOM-free, unit-tested)

Two pure functions plus a type. No DOM access inside — a thin client wrapper reads `matchMedia`/`navigator` and passes plain values in. This keeps them unit-testable in the existing Vitest suite.

```ts
export type ProfileName = "desktop" | "tablet" | "handheld";

export interface FieldProfile {
  name: ProfileName;
  baseCellPx: number;     // base font size before budget growth
  dprCap: number;
  octaves: number;        // warp engages only when octaves >= 3 (noise.ts:94)
  recomputeEvery: number; // run the expensive target pass every Nth frame
  cellBudget: number;     // max cols*rows; cell size grows to hold this
  lowPowerHint: boolean;  // Wordmark caps its wave loop at 30fps when true
}

export interface DetectEnv {
  pointerCoarse: boolean;   // matchMedia('(pointer: coarse)') — PRIMARY pointer
  hover: boolean;           // matchMedia('(hover: hover)')
  cores?: number;           // navigator.hardwareConcurrency
  deviceMemory?: number;    // navigator.deviceMemory (Chromium only)
  vw: number;
  vh: number;
}

export function detectProfile(env: DetectEnv): FieldProfile;
export function chooseCellMetrics(
  vw: number, vh: number, profile: FieldProfile,
): { fontSize: number; charW: number; charH: number };
```

**`detectProfile` logic:**
1. If `!pointerCoarse && hover` → **desktop**.
2. Else (touch-primary): `shortSide = min(vw, vh)` → `shortSide < 520` → **handheld**, else **tablet**.
3. **Power nudge (demote-only, never promote):** if `cores` known and `≤ 4`, *or* `deviceMemory` known and `≤ 4`, step one tier *down* in quality (desktop→tablet knobs, tablet→handheld knobs). Missing hints are ignored (never required).

**Profile knobs (starting values):**

| knob | desktop | tablet | handheld |
|---|---|---|---|
| `baseCellPx` | 13 | 14 | 15 |
| `dprCap` | 2 | 2 | 1.5 |
| `octaves` (warp) | 3 (warp on) | 2 (off) | 2 (off) |
| `recomputeEvery` | 2 | 3 | 3 |
| `cellBudget` | 16000 | 11000 | 4000 |
| `lowPowerHint` | false | true | true |

These reproduce today's behavior on the two known-good devices (laptop = desktop knobs; phone portrait = handheld knobs) and add a correct middle tier.

### 2. Cell-count budget — `chooseCellMetrics`

```
needed   = ceil( sqrt( vw*vh / (0.81 * profile.cellBudget) ) )
fontSize = clamp( max(profile.baseCellPx, needed), baseCellPx, FONT_MAX )   // FONT_MAX ~= 32
charW    = fontSize * 0.6
charH    = fontSize * 1.35   // LINE_HEIGHT, unchanged
```

- Small/normal viewports: `needed ≤ baseCellPx` → `fontSize = base` → **laptop and phone are byte-for-byte unchanged.**
- Large viewports: `fontSize` grows *just enough* to hold `cellBudget`. Glyphs stay crisp, integer-pinned, on the shared lattice (no offscreen-buffer upscaling, no blur).
- Predicted by the cost model: 2560 → ~16.9px / ≈14k cells / ~95fps; 4K → ~25px / ≈16k cells / ~95fps; iPad (tablet profile, 11k budget) → 60fps+.

`cellBudget` values and `FONT_MAX` are **starting constants to be pinned by a re-measure + visual pass** — same discipline as `CONTRAST_LO` / `GRAVITY_STEPS`. The 4K glyph size (~25px) is the one aesthetic unknown and must be eyeballed before locking.

### 3. Interaction model — branch on `pointerType`, not width

In `AsciiGrid`'s pointer handlers, remove the `s.mobile` gate and branch on `e.pointerType`:
- `onPointerMove`: `mouse` → `addTrailSample` with speed (today's wake); `touch`/`pen` → ignored (a finger dragging is almost always a scroll; reacting would fight the scroll and cost frames).
- `onPointerDown`: `mouse` → `emitClick` ripple; `touch`/`pen` → `addTrailSample(x, y, now, 0)` tap halo.

Result: iPads and landscape phones become interactive. No device-class check involved — purely the input that actually occurred.

### 4. iOS resize hardening

`onResize` triggers a full rebuild **only** when **width**, **orientation**, or **devicePixelRatio** changes vs. the last build. Height-only deltas (URL-bar show/hide) are ignored. To prevent a short/blank field when the toolbar hides (taller viewport), size the canvas height to `max(currentInnerHeight, lastBuiltHeight)` and let the extra rows render. Keep the existing 150ms debounce. Optionally consult `visualViewport`, but the width-guard alone removes the rebuild storm.

### 5. Idle throttle

Add an `active` determination per frame in the loop, from inputs `AsciiGrid` already has:

```
active = introElapsed < INTRO_RECEDE_END
      || trailEnergy > EPS            // any trail weight above threshold
      || ripples.length > 0
      || abs(scrollDrift) > EPS
      || heroDissolve is mid (0 < x < 1)
      || any erosionZone.progress mid (0 < p < 1)
      || footerGravity is mid (0 < g < 1)
```

- **active** → full cadence (today's behavior, unchanged).
- **idle** → throttle recompute **and** draw to ~15fps via a time accumulator (the ambient morph period is 60s — 15fps is imperceptible). rAF keeps running; only the work is gated.
- **Wake is immediate:** pointer/scroll handlers flip an `awake` flag synchronously on the input event, so there is zero perceptible wake lag (never wait for the next idle tick).
- **Reduced motion** path (single static frame, no rAF) is untouched.

Battery/thermal win on mobile is the primary motive; it also lightens idle desktop.

### 6. Wordmark alignment

`Wordmark.tsx:205` replaces its inline `innerWidth < 768` with the shared profile's `lowPowerHint` to decide its 30fps wave-loop cap. Single source of truth; Wordmark and AsciiGrid never disagree on device class.

---

## Architecture / files touched

- **`lib/ascii/profile.ts`** — *new.* Pure `detectProfile` + `chooseCellMetrics` + types. DOM-free.
- **`components/ascii/AsciiGrid.tsx`** — consume profile in `resize()` (replaces `fontSizeFor` + the `mobile` boolean + the dpr line); pointer handlers branch on `pointerType`; `onResize` width-guard; idle throttle + wake flag in `loop`.
- **`lib/ascii/field.ts`** — `FieldEngine` constructor takes `octaves` instead of the `mobile` boolean; no math changes. (`recomputeEvery` stays in `AsciiGrid`'s loop, read from `profile`.)
- **`components/hero/Wordmark.tsx`** — use shared profile `lowPowerHint` for its fps cap.
- **Tests** — `lib/ascii/profile.test.ts` (new).

Client wrapper (in `AsciiGrid`, effect-time only — no SSR read) builds `DetectEnv` from `matchMedia('(pointer: coarse)')`, `matchMedia('(hover: hover)')`, `navigator.hardwareConcurrency`, `navigator.deviceMemory`, `innerWidth/innerHeight`. Recompute on mount, on width/orientation change, and on `matchMedia` change events.

---

## Verification

1. **Unit tests** (`profile.test.ts`):
   - `detectProfile`: desktop (fine+hover), handheld (coarse, short side <520), tablet (coarse, ≥520); power-nudge demotes when cores/mem ≤4; missing hints never required.
   - `chooseCellMetrics`: returns `base` for laptop/phone (unchanged); caps cells ≤ budget for 2560/4K/iPad; never below `baseCellPx`; respects `FONT_MAX`.
2. **Re-measure** with the same probe across all six scenarios. **Targets:** 2560 ≥ 90fps; 4K ≥ 60fps; iPad ≥ 60fps **and** interactive; phone portrait unchanged (≈100fps); landscape phone on the light pipeline.
3. **Visual screenshots** at 2560 / 4K / iPad — confirm the larger-glyph field still reads correctly. Adjust budgets if 4K glyphs look wrong.
4. **Gates:** `pnpm typecheck && pnpm lint && pnpm build` clean; existing 37 engine tests still pass; first-load JS stays ≤ current 158.3KB gz (net-small change).
5. **Reduced motion** still renders one static frame with zero rAF after first paint.

---

## Risks & mitigations

- **4K glyph size (~25px) aesthetics** — the one real unknown. Mitigation: visual-validate before locking; budget is a single tunable constant.
- **`deviceMemory` is Chromium-only** — used only as an optional demote nudge; never required.
- **Idle wake lag** — mitigated by flipping the wake flag in the input handler itself, not on the next idle check.
- **Profile churn on rotate** — recompute is debounced with the existing 150ms resize timer; rebuild only fires on genuine width/orientation/DPR change.

---

## Out of scope (deferred)

- Runtime frame-time **governor** (auto step up/down to hold target fps). The static profiles + cell budget cover the measured matrix; the governor is the next tier if the long tail demands it.
- The minor startup **forced reflow** (transient, not steady-state).
- Pre-rendering the substrate mesh to an image (separate perf item, not field-related).
