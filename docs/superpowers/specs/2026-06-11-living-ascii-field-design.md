# The Living Field — ASCII System Rebuild (Aino-grade)

Supersedes the ASCII-field portions of `2026-05-24-interactive-resume-design.md`.
Everything else in that spec (sections, copy, typography, tokens, effects 05–12) stands.
Scope here: the full-viewport field (`AsciiGrid`), its ramp, its intro sequence, and its
scroll/cursor integration — end to end.

---

## Why

The current field is per-cell random noise (`LIGHT_BIAS` buffer + 300ms churn timer). It
reads as TV static. Aino's field reads as a *surface* because neighboring characters
relate — density is driven by a coherent brightness field, characters move *through* a
deep ramp with easing, and emptiness does as much work as ink. This rebuild closes that
gap while keeping the site's architecture, perf model, and design rules intact.

**What the visitor should feel:** the page is printed on something alive. Ink floods in,
the name crystallizes, the ink recedes — and keeps breathing under everything.

---

## 1. The ramp — 25 steps, the name embedded

`lib/ascii/ramp.ts`, light → dense:

```
(space) · - : / + = > < ! ? 3 I 2 5 4 6 9 8 R 0 L Y A T
  0     1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
```

Read from the dense end: **T-A-Y-L-0-R**. The name is embedded in the rendering system —
the same signature move as Aino's `NO0A…` ramp ("NOAI"). Index 0 is a true space:
characters can fully *leave* the field (erosion descends to literal emptiness).

**Perceptual smoothness without perfect ordering.** `L` and `Y` carry less ink than `0`
and `A`, which would dent a naive gradient. Fix: at atlas build time, measure each
glyph's actual ink coverage from the atlas pixels and store a per-glyph alpha
normalization table. A cell's perceived luminance is `luminance(rampIndex) ×
coverageNorm[glyph]` — the brightness gradient stays monotonic regardless of glyph
shape. (This also future-proofs any ramp edit.)

**The dense end is reserved for ceremony.** Ambient density is capped at index 14 (`5`)
— the letters `R 0 L Y A T` never appear in the resting field. They surface only at
three moments: the intro crest, under the cursor trail, and in the footer gravity flood.
Scarcity is what makes the signature legible as a signature.

**Block ramp stays in the UI.** `░ ▒ ▓ █` remain as discrete indicator glyphs
(WorkCard, BorderBeam, Wordmark, TextGenerate). The *field* is fully typographic —
blocks tiled across a viewport at 13px read heavy; type reads woven. Exported separately
(`FIELD_RAMP` for the canvas, `BLOCK_RAMP` for components); `ScrambleLink` /
`HeaderDecode` scramble charsets switch to mid-ramp field characters (`: / + = > < ! ?
3 I 2 5`) so every effect speaks one language.

---

## 2. One pipeline — target density, eased

The single biggest architectural change: there is no separate intro engine, no buffer
handoff, no mode switch. Every cell has one continuously-maintained pair:

```
target[i]  — where the cell wants to be on the ramp (float, 0–24)
current[i] — where it is (float), eased toward target every frame
```

```
target = clamp(
    ambient(cell, t)               // §3 — domain-warped fbm, contrast-curved
  × heroScale(scroll)              // §6 — field yields to the wordmark
  × erosionMask(cell, zones)       // §6 — content clearings, soft shore
  × introMask(cell, t)             // §5 — bloom envelope (1 after intro)
  + introCrest(cell, t)            // §5 — the traveling ink front (0 after intro)
  + trailLift(cell, t)             // §4 — cursor trail
  + gravityLift(cell, scroll)      // §6 — footer flood
)

current += (target − current) × (1 − e^(−dt/τ))
```

Easing time constants are *contextual* — this is what makes the field feel like a
material instead of a tween:

| context              | τ        | feel                          |
| -------------------- | -------- | ----------------------------- |
| ambient drift        | ~220ms   | slow ink settling             |
| cursor trail rise    | ~80ms    | immediate response to touch   |
| cursor trail decay   | ~350ms   | wake dissipating              |
| erosion open/close   | ~400ms   | ink receding from content     |

Draw: `glyph = FIELD_RAMP[round(current)]`, `alpha = luminance(current) ×
coverageNorm[glyph]`. Alpha is continuous between ramp steps, so motion is smooth even
as glyphs change discretely. Cells with alpha < 0.01 are skipped entirely — and because
the ambient field is deliberately sparse (§3), this rebuild *draws fewer cells per
frame than the current code*.

The old phases (`breathingAlpha`, `sparkleBoost`, churn) are deleted. Breathing and
sparkle both fall out of the noise field naturally: slow morphing IS breathing; cells
near a contrast threshold flicker up and over it as the field drifts — organic sparkle
with zero extra code.

---

## 3. The ambient field — domain-warped fbm

Implemented in `lib/ascii/noise.ts` (~60 lines, zero dependencies): permutation-table
value noise, 3-octave fbm (lacunarity 2, gain 0.5), single-layer domain warp
(Iñigo Quílez pattern: `field = fbm(p + W·(fbm(p+e₁), fbm(p+e₂)))`). The warp is what
turns blobs into the liquid, current-like structure.

Tuning decisions (all constants in one block, commented):

- **Sample in pixel space, not cell space.** Cells are ~7.8×17.6px; sampling per-cell
  coordinates would stretch every feature 2.25× vertically. Pixel-space sampling keeps
  the clouds round.
- **Feature wavelength ≈ 30% of min(vw, vh).** 2–4 large structures visible at once —
  big enough to read as composition, small enough to always have life on screen.
- **Two motions, layered.** Advection (the whole field drifts diagonally at ~8px/s) plus
  morph (time as a third noise phase, ~60s period). Drift alone is sliding wallpaper;
  morph alone is boiling; together it reads as weather.
- **Contrast curve creates emptiness.** `density = smoothstep(0.42, 0.85, fbm)` — about
  half the field rests at or near space. Aino's beauty is in the emptiness; ink lives in
  islands with soft shores. Ambient alpha tops out ~0.16 (slightly above today's ceiling,
  affordable because far fewer cells are inked).
- **Ambient ramp ceiling: index 14.** Letters are ceremony-only (§1).

**Frame budget.** ~4.5k cells × (2 warp + 1 final) fbm ≈ 40k noise evals. Targets are
recomputed every 2nd frame on desktop, every 3rd on mobile; the easing pass (one
multiply-add per cell) runs every frame, so motion stays 60fps-smooth while the
expensive pass runs at 30/20Hz — invisible behind τ ≥ 80ms easing. All state in
preallocated `Float32Array`s; zero allocation in the loop.

---

## 3b. Beyond Aino — what makes it ours

Aino's field is pointillist: density only. Ours gets three properties theirs doesn't
have. None adds color, glow, or a new visual language — they deepen the one we have.

**A. Flow-aligned strokes — the field is calligraphic, not pointillist.**
In the mid-density band (indices 3–9), the drawn glyph is substituted by the *local flow
direction* of the field: `-` for horizontal flow, `|` for vertical, `/` and `\` for
diagonals (angle bucketed into four). Direction comes from finite differences on the
already-computed target grid — zero extra noise evaluations. Low density stays dots and
ticks; high density stays digits and letters; but the middle — the bulk of every visible
cloud — renders as strokes *aligned with the current that shaped it*. The field stops
being noise rendered in text and becomes something like a woodcut of weather: currents
you can trace with your eye. This is the single highest-leverage beauty move in the
rebuild, and nothing on aino.agency does it.
Mechanics: density math is untouched (ramp index is still the only dimension);
substitution happens at draw time. The atlas gains `\` and `|` as variant glyphs, and
alpha uses `luminance(densityIndex) × coverageNorm[drawnGlyph]`, so brightness stays
monotonic through substitutions.

**B. One heartbeat — the mark and the medium share physics.**
The wordmark already breathes (the diagonal sheen wave, every ~5.2s). Today the field
doesn't know. Now each wordmark pulse emits a faint radial **ripple** into the field
from the mark's center: a +2 ramp band traveling outward, dissipating by ~40% of the
viewport. Active only while the hero holds the viewport (`heroDissolve < 0.5`). The
effect is subliminal — the page has *one* pulse, and everything answers to it.
Mechanics: `lib/ascii/pulse-store.ts`, a 20-line store like `scroll-store` (Wordmark
publishes pulse timestamps + origin; the field engine consumes). Ripples are an additive
mask on `target` — same code path serves §3b-C.

**C. Touch the ink.**
- **Click ripple:** pointer-down anywhere drops a single ink ripple (crest +4 ramp,
  one ring, ~900ms). The medium is tactile everywhere, not just under the cursor wake.
  Max 3 concurrent ripples; oldest evicted.
- **Scroll drag:** scroll velocity adds a small, capped counter-advection to the field
  drift — scrolling reads as *moving through* the medium, which answers your motion like
  water. Decays back to ambient wind over ~1.5s. (Touch scrolling gets this too — it's
  the one field interaction mobile keeps.)

Reduced motion: all three off (static frame, as specced).

---

## 4. The cursor: a wake, not a spotlight

The fixed 140px halo becomes a **trail**. A ring buffer holds the last 24 pointer
samples `{x, y, t, speed}`. Each sample contributes
`gauss(dist / r) × e^(−age/280ms)` of ramp lift, summed and capped at +8 steps.

- **Radius scales with speed** (90px slow → 150px fast): a slow cursor draws a fine
  line, a fast sweep drags a broad wake — brush dynamics.
- **+8 steps reaches the letters.** Stirring the field is how a visitor first
  *discovers* `T A Y L 0 R` surfacing under their hand. The brand reveal is an
  interaction reward, not a billboard.
- Idle cursor: the wake decays fully in ~1s; no permanent hotspot.
- Touch: existing behavior kept (tap = single halo sample, 600ms fade). Desktop-only
  trail physics.

---

## 5. The intro — ink bloom, density-first

Same total envelope as today (wordmark `RESOLVE_DONE_MS = 4800`, scroll unlock 6000ms,
overflow-lock script — all untouched). What changes: the field intro is a *density*
event, not an alpha fade, and it is a modulation on the one pipeline (§2), so the
intro→ambient handoff is seamless by construction — no `introSeeded` reseeding.

| t (ms)      | field                                                                  | wordmark (existing, unchanged)     |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------- |
| 0–250       | **Dormant.** Scattered specks (`·` `-`) at alpha ≈ 0.05. Asleep.       | blank                              |
| 250–2600    | **Ink bloom.** A radial front (pixel-space, eased `1−(1−t)^1.8`) sweeps center → corners. At the front line, cells crest **+6 ramp steps** above their ambient target — dense islands flash into digit/letter range as the front passes. Behind the front, cells ease to an overshoot of ~1.5× ambient. Per-cell ±60ms arrival jitter keeps the edge organic. The *structured* field is visible immediately behind the front — the bloom reveals weather, not a flat wash. | cells appearing as `░` (from ~250) |
| 2600–3600   | **Peak.** The whole field holds elevated density and takes one slow synchronized breath. | cells climbing the ramp `░ → █`    |
| 3600–5100   | **Recede.** Cells ease down from overshoot to ambient targets — edges first, center last. The recede overlaps the wordmark's final inking (resolve completes at 4800): the ink reads as draining *out of the field, into the name*. Lands as the scanline sweeps (4900) and the bio/CTAs fade up (5100/5350). | resolve completes 4800; scanline 4900; reg ticks, bio, CTAs |
| 5100+       | Ambient. Breathing, drifting, waiting for the cursor.                   | ambient wave pulses                |

Reduced motion: no bloom — one static frame of the ambient field, no rAF loop, no
listeners (current behavior, preserved).

`lib/ascii/intro.ts` (the radial-alpha `IntroEngine`) is deleted; the bloom is ~40
lines of mask math inside the field engine.

---

## 6. Scroll integration — re-pointed to density

All existing APIs keep their shape; what they modulate changes from alpha to ramp.

- **`heroDissolve`** scales ambient targets ×0.55 → ×1.0. In the hero the field yields
  to the wordmark; past it, full weather. (Replaces today's alpha-halving.)
- **Erosion zones** (`SectionWrapper`, geometry/progress lerp unchanged):
  `erosionMask` becomes a *density* multiplier with a soft shore — approaching a content
  rect, characters step down the ramp (`5 → ! → + → : → · → space`) rather than ghosting
  out at full shape. Content sits in a clearing with a thinning ASCII shoreline. The four
  shaped geometries (center-out / top-down / edges-in / bottom-up) are kept as-is in
  `density.ts`; only the return value's meaning changes (the alpha-multiplier signature
  is preserved, applied to `target` instead of `alpha`).
- **Section divider band**: kept, expressed as a ramp boost (already is).
- **`footerGravity`**: targets climb toward the dense end, uncapped — this is the one
  place the ambient ceiling lifts and `R 0 L Y A T` flood the lower viewport. **The page
  ends in the name.** The existing final-void fade past 0.8 is kept so the very bottom
  resolves to quiet around the contact line.

---

## 6b. Micro-interactions — the Aino-craft pass

Live exploration of aino.agency (61 captures; catalog in the research notes) shows their
distinctiveness is less the field than the *density of tiny, precise interactions* —
24 cataloged. The ones worth our language, upgraded for ours:

**Char-precision hover scramble (upgrade `ScrambleLink`, reuse on WorkCard titles).**
Aino's signature: only the characters *under and adjacent to* the cursor scramble — the
glyph you touch, ±1 cell — each walking the ramp-alphabet out and back on an
easeOutQuint triangle wave (~1000ms), case preserved. Today our ScrambleLink scrambles
the whole label; localized scramble reads as touching letters, not triggering an effect.
Monospace makes hit-testing trivial (`offsetX / charW` — no caret APIs). Keyboard focus
keeps the existing whole-label scramble (no cursor to localize). Scramble alphabet: the
mid-ramp field characters (§1) — our equivalent of Aino salting theirs with Ø/Ä/Å.

**Ramp-walk as the universal enter.** Aino resolves *every* image and text block along
the ramp on load and on each route change (space → char, ~1500ms, 50ms per-row sweep) —
arrival itself is the identity. We already own this grammar (`DensityResolve`,
`TextGenerate`, `HeaderDecode`); the pass here is unification: all three re-tuned to the
new 25-step ramp with one shared constants block (per-char 400ms, per-row sweep 50ms),
so every materialization on the page is recognizably the same physics as the field.

**A live clock in the footer.** Aino's footer ticks `GBG/SAL · HH:MM:SS`. Ours gains
`bay area · HH:MM:SS` (local time), seconds ticking, in the existing `--fg-quiet` 11px
line. One `setInterval(1000)`, mounted with the footer, cleared on unmount; static
timestamp under reduced motion. The quietest possible proof the page is alive.

**A definitive end-state, borrowed as principle.** Aino's intro ends with a physics
collapse into the logo — it *concludes*, it doesn't loop. Ours already does this in our
own grammar (the recede drains the field's ink into the wordmark, §5); noted here so the
implementation treats the intro's final frame as a composition, not a fade-out.

**Deliberately not taken** (parking lot, post-v1): the TEXT/PIXEL mode easter egg,
cursor-cell text labels ("CLICK" — we have no click-gated content, and CLAUDE.md bans
scroll/interaction hints), retro palette themes, the arcade. Restraint is the brief.

---

## 6c. Architecture divergence note — canvas, not text node

Aino renders the field as a single `<div>` text node rewritten per frame — elegant, but
a text node has **no per-character alpha**, and our entire luminance model (§1, §2 —
continuous alpha between ramp steps, coverage normalization, soft shores) depends on it.
Aino doesn't need it: dark-on-paper at full opacity. We keep the existing
canvas + glyph-atlas renderer (already built, profiled, atlas-batched) and adopt the
part of their architecture that *is* better: strict grid discipline — the
`--ascii-cols/rows/ch/line` CSS variables we already export stay the single source of
truth so DOM content and field cells share one lattice.

---

## 7. Atlas and font

- Atlas extends to 25 glyphs and renders with **Monaspace Neon** (`var(--font-mono)` is
  the site's identity; the current atlas uses `ui-monospace` — a seam, since digits and
  letters are now prominent). Build the atlas immediately with the fallback stack, then
  rebuild once on `document.fonts.ready`. No layout shift — same metrics box.
- Per-glyph ink-coverage table measured from atlas pixels at build time (§1).
- DPR capping, mobile cell-size increase (13px → 15px on <768px), and the
  resize-debounce all carry over.

---

## 8. Performance & degradation budget

| surface              | desktop                     | mobile (<768px)                |
| -------------------- | --------------------------- | ------------------------------ |
| noise                | 3 octaves + warp            | 2 octaves, no warp             |
| target recompute     | every 2nd frame             | every 3rd frame                |
| easing + draw        | every frame                 | every frame                    |
| cell size            | 13px                        | 15px                           |
| cursor               | trail (24 samples)          | tap halo only                  |
| DPR cap              | 2                           | 1.5                            |

Frame target: < 6ms total on a mid-range laptop. Pause on `document.hidden` (kept).
Skip-draw for alpha < 0.01 (sparse field → fewer draws than current). Zero allocation
per frame. Zero new dependencies. `prefers-reduced-motion`: single static frame.

---

## 9. Files

| file                                  | change                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| `lib/ascii/ramp.ts`                   | `FIELD_RAMP` (25), `BLOCK_RAMP` (UI), directional variants (`\` `|`), luminance curve |
| `lib/ascii/noise.ts`                  | **new** — value noise, fbm, domain warp                       |
| `lib/ascii/field.ts`                  | **new** — target/current engine, intro bloom, trail, ripples, flow substitution, gravity |
| `lib/ascii/pulse-store.ts`            | **new** — ~20 lines; wordmark pulses + click ripples → field  |
| `lib/ascii/intro.ts`                  | **deleted**                                                   |
| `lib/ascii/density.ts`                | erosion kept (geometries unchanged); breathing/sparkle deleted |
| `components/ascii/AsciiGrid.tsx`      | rewritten around the engine; atlas + coverage table; trail/ripple/scroll-drag input |
| `components/hero/Wordmark.tsx`        | one-line addition: publish wave pulses to pulse-store         |
| `lib/ascii/scramble.ts` + consumers   | charset → mid-ramp field characters                           |
| `components/hero/ScrambleLink.tsx`    | char-precision hover scramble (ramp-travel triangle wave)     |
| `components/story/DensityResolve.tsx`, `TextGenerate`, `HeaderDecode` | re-tuned to 25-step ramp, shared constants block |
| `components/footer/Footer.tsx`        | live clock (`bay area · HH:MM:SS`)                            |
| everything else                       | untouched (Hero, sections, scroll-store, SectionWrapper)      |

---

## 10. Success criteria

1. `pnpm typecheck && pnpm lint && pnpm build` clean.
2. Unit tests for the pure math: ramp monotonicity (luminance × coverage), noise
   range/continuity, easing convergence, erosion mask bounds, intro mask continuity at
   phase boundaries (no value jumps > 1 ramp step at boundary crossings).
3. Visual: at rest the field shows 2–4 coherent drifting structures, ~half the viewport
   empty; mid-density regions read as flow-aligned strokes (currents traceable by eye);
   no letter glyphs visible ambiently; cursor sweep surfaces letters; intro reads
   bloom → peak breath → recede with no visible mode seam; wordmark pulses visibly
   ripple the field in the hero; click drops an ink ripple; footer floods with name
   characters then resolves quiet; hovering a link scrambles only the characters under
   the cursor; footer clock ticks.
4. Frame time < 6ms desktop mid-range, no per-frame GC (DevTools performance trace).
5. Reduced motion: static frame, zero rAF after first paint.
6. CLS 0, bundle delta ≤ +3KB gz (noise + engine offset by deleted intro engine).

---

## Non-negotiables honored

Dark only · monochrome only (luminance steps, no hue) · Monaspace only (atlas now
*more* compliant than before) · ASCII as identity (deepened — the ramp now *is* the
name) · restraint (ambient is sparser and quieter than today; the spectacle is reserved
for three moments) · `prefers-reduced-motion` everywhere · performance as design.
