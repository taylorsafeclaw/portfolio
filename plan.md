# Plan — taylorallen.dev v1 (revised after adversarial review)

This plan supersedes the page architecture in `HANDOFF.md`. Hero stays. Selected Work is killed and replaced by inline bio footnotes. The site becomes **hero (with footnoted bio) → NowPlaying → colophon footer**. One ASCII animation engine drives every animated element. The status flare is killed entirely — NowPlaying is the "alive" signal and a second one would be noise.

`HANDOFF.md` remains canonical for tokens, fonts, voice, and the locked design rules. This plan only changes content architecture and adds NowPlaying + bio footnotes.

---

## 1. Thesis

Without a real portfolio, the most honest version of this site is:
- **Hero** — who I am (existing wordmark + bio, plus inline footnotes that carry the portfolio weight)
- **Now playing** — what I'm listening to *right now*, rendered as ASCII (new)
- **Colophon footer** — name, year, build credits, email

That's the entire site.

The cohesion move: **everything ASCII shares one animation primitive**. The wordmark, the album art, and the footnote tooltip body all consume `<AsciiCanvas>` and pulse on a single shared 5.2s clock. Mirrored geometries, synced heartbeats. The page breathes as one organism.

---

## 2. Final page architecture

```
PAGE (scrolling — no fixed-position elements)

├── Hero                  100vh
│   ├── GridLayer         (existing)
│   ├── AsciiField        (existing)
│   ├── Vignette / Grain  (existing)
│   ├── Wordmark          (refactored to consume <AsciiCanvas>)
│   ├── Scanline / RegTicks (existing)
│   ├── Bio paragraph     (existing copy + 3 inline footnote markers)
│   └── Email CTA         (existing)
│
├── NowPlaying            ~50vh
│   ├── Section header    "now playing" (Monaspace Xenon)
│   ├── AlbumAscii        48×48 grid (consumes <AsciiCanvas>, mirrored wave geometry)
│   ├── Track metadata    "Track Name — Artist Name"
│   ├── Progress bar      simple block chars: ███░░░░  2:14 / 4:03
│   └── Idle state        signature glyph + "last played 4h ago"
│
└── Colophon footer       ~10vh
    └── Taylor Allen · 2026 · monaspace · next.js · no analytics · taylor@taylorallen.dev
```

Total page length: ~1.6 screens. No status flare, no persistent overlays. Pure scroll.

---

## 3. Bio footnotes (replaces Selected Work)

The bio paragraph ships with three inline footnote markers. Hovering the marker (or its preceding word) reveals a tooltip with structured project info, animated with the same ASCII inking effect as the wordmark.

### Markup

```
Hi, I'm Taylor. Builder from the Bay. Repeat founder.
Shipped startups¹ from 0 → 1, gone deep on enterprise systems²,
now back to building³. Mostly drawn to the parts other people
skip, where taste compounds.
```

### Marker spec

- Character: real Unicode superscripts `¹ ² ³`
- Color: `--fg-muted` (visible on second glance, not on first)
- Size: same as body text — Unicode superscripts already render small
- The hover target is the **whole word** before the marker, not just the marker

### Discovery seed

To prevent the feature dying invisible: `startups` (the first footnoted word) gets a permanent faint underline in `--fg-quietest`. The other two words (`enterprise systems`, `building`) only show their underline on hover. The visible first underline is the trail of breadcrumbs that leads visitors to discover the rest.

### Tooltip spec

```
┌────────────────────────────────┐
│ ▓ poppin                       │
│   2021 → 2023                  │
│   social events app            │
│   co-founder & cto · pear-backed │
│                                │
│   exited                       │
└────────────────────────────────┘
```

- Background: `--bg-elev-1`
- Border: 1px hairline `--border`, sharp corners (`rounded-sm` max)
- Padding: `12px 16px`
- Font: Monaspace Neon throughout
- Width: `min(360px, 90vw)`
- No shadow, no glow, no blur backdrop

Density char prefix uses the killed Selected Work spec's vocabulary:
- `█` — current build
- `▓` — recent / shipped
- `▒` — older / archived

### Animation

The tooltip frame fades in over 180ms with a 1px upward translate. The text *inside* runs an inking sequence — each character starts as `·` and climbs the ramp to its target glyph over 220ms, randomized per cell. Same primitive as the wordmark, compressed.

The inking is delivered via `<AsciiCanvas resolveOnMount>` rendering the tooltip body. Same mechanism, different scale. This is the cohesion proof point: footnotes ink in using the same machinery the wordmark uses to resolve.

`prefers-reduced-motion`: skip the resolve, plain fade in over 100ms.

### Three footnotes — content

**¹ — `startups`**
```
▓ poppin
  2021 → 2023
  social events app
  co-founder & cto · pear-backed
  exited
```

**² — `enterprise systems`**
```
▒ stanford health
  2021 → 2023
  enterprise architect
  built internal tools across 7 hospital systems
```

**³ — `building`**
```
█ [current build]
  2026 →
  ai · llm tooling
  early, in the dirt
```

(Final copy on each pending Taylor's confirmation.)

### Mobile behavior

Touch devices: tap on a footnoted word inserts the tooltip *inline* below the bio paragraph as an expanding panel (not a floating overlay). Pushes content down; tap again or tap outside to collapse. No floating tooltip on touch — bad UX for thumbs.

Marker color on mobile is `--fg-strong` (more visible than desktop's `--fg-muted`) and the first word's underline is permanent — full discovery affordance since hover doesn't exist.

### Accessibility

- Footnoted words rendered as `<button>` (semantically wrong as `<a>` since they don't navigate)
- Reachable via Tab; focus state shows the same underline + a `▌` block prefix
- Enter/Space opens tooltip; Escape closes
- Tab order: `startups → enterprise systems → building → email CTA`

### Implementation foundation

- **Radix UI `Tooltip`** for positioning, collision detection, focus management. ~3KB gz, headless.
- **NOT** Aceternity's `AnimatedTooltip` — that one's for avatar groups with 3D rotation.
- Reskin Radix completely; tokens-only, sharp corners, mono font.
- `<AsciiCanvas>` renders the tooltip body for the inking animation.

### Files

```
components/footnote/Footnote.tsx        ← reusable footnoted word + tooltip
components/footnote/FootnoteContent.tsx ← AsciiCanvas-based content renderer
components/hero/Hero.tsx                ← bio paragraph wraps three words in <Footnote>
lib/footnotes.ts                        ← static content for the three footnotes
```

---

## 4. Shared primitive — `<AsciiCanvas>`

Currently `Wordmark.tsx` is ~340 lines doing five things. The resolve + wave logic is generic — extract it. The cursor halo and dimensional echo stay in `Wordmark` since they're not generic.

### Location

`components/ascii/AsciiCanvas.tsx` (new folder). Pure helpers in `lib/ascii/`.

### API

```tsx
type WaveAngle = "tl-br" | "tr-bl" | "horizontal";
type WaveBehavior = "brighten" | "downstep";

interface AsciiCanvasProps {
  /** 2D array of target characters. " " for empty cells. */
  target: string[][];
  /** Density ramp lightest → densest. */
  ramp?: readonly string[];     // default ["·", "░", "▒", "▓", "█"]
  /** Run appear → set on mount. */
  resolveOnMount?: boolean;     // default true
  /** Re-run resolve when target identity changes. */
  resolveOnChange?: boolean;    // default false
  /** Wave heartbeat in ms. */
  wavePeriodMs?: number;        // default 5200
  /** Diagonal direction. */
  waveAngle?: WaveAngle;        // default "tl-br"
  /** Cells in band brighten or downstep. */
  waveBehavior?: WaveBehavior;  // default "brighten"
  /** 0..1 multiplier on glow swell. */
  glowIntensity?: number;       // default 1
  /** Color for filled cells. */
  color?: string;               // default "var(--fg-peak)"
  className?: string;
  ariaLabel?: string;
}
```

### Scope

`<AsciiCanvas>` owns:
- The cell grid state and rAF loop
- Resolve sequence (appear → set, randomized per-cell delays)
- Wave pulse computation and brightening logic
- Glow swell value (exposed via CSS variable for sibling overlays to read)
- `prefers-reduced-motion` handling
- `document.hidden` pause
- One `<pre>` with the resolved/animating text

`<AsciiCanvas>` does NOT own:
- Cursor halo overlay (Wordmark composes that as a sibling `<pre>`)
- Dimensional echo (Wordmark composes that)
- Aspect-ratio handling for non-square grids (consumer's problem)

This means post-refactor, Wordmark.tsx is ~80 lines: glyph map, halo/echo overlays, AsciiCanvas instance. NowPlaying composes AsciiCanvas + adjacent metadata.

### Shared global clock

Both AsciiCanvas instances reference a module-level `performance.now()` epoch set on first import. **Both pulse at exactly t=5.2s, 10.4s, 15.6s — synchronized, not offset.** Mirrored *geometry* (tl-br vs tr-bl) provides the visual distinction. The eye reads the wordmark and album art as struck simultaneously by the same wave, traveling in opposite directions across the page.

This is corrected from the prior plan, which proposed offset phases. Sync is more taste-coded.

### Refactor strategy

1. Extract pure helpers (`rampForProgress`, `buildWaveBoost`, `easeOutCubic`) → `lib/ascii/`
2. Build `AsciiCanvas` from helpers
3. Migrate `Wordmark` to compose `AsciiCanvas` + halo + echo siblings
4. Visual diff against pre-refactor screenshot — pixel-identical or doesn't ship

### Files

```
components/ascii/AsciiCanvas.tsx      ← shared primitive
lib/ascii/ramp.ts                     ← RAMP constant + rampForProgress
lib/ascii/wave.ts                     ← buildWaveBoost + easings
lib/ascii/clock.ts                    ← shared epoch
components/hero/Wordmark.tsx          ← refactored: glyph map + halo + echo + AsciiCanvas
```

---

## 5. NowPlaying

### Layout

```
                  now playing
            ──────────────────────

               [48×48 ASCII grid]
              centered horizontally
              ASCII album fingerprint

           Track Name — Artist Name
           ███░░░░░░░░░  2:14 / 4:03
```

Section height: ~50vh (tightened from prior 70vh; album art + 2 lines of metadata doesn't need more).

### Section header

- Text: `now playing`
- Font: `var(--font-display)` (Monaspace Xenon — the only Xenon use on the page)
- 13px, weight 400, color `--fg-strong`
- Lowercase, letter-spacing 0.04em
- Centered
- 96px above, 32px below

### Album art conversion

**This is the highest-risk part of the plan.** I claimed ASCII'd album art would look great. Reality: 48×48 luminance mapping mushes most album covers (faces, photographic art, busy paintings). Unmitigated, this feature ships ugly more often than not.

**Day-1 spike** (Phase 2.5 — see Build Order): build the converter, test against 20 covers from Taylor's actual Spotify library. Pick one of three algorithms by evidence:

- **(a) Luminance → ramp.** Plain. Best on high-contrast/minimal art.
- **(b) Atkinson dither → ramp.** Texture instead of mush. Best on photographic art.
- **(c) Sobel edge detection → 1-bit → ramp.** Iconic linework. Best on portraits.

If all three lose ≥ 60% of the test set, **fall back to (d): deterministic fingerprint** — a generative ASCII pattern seeded by track ID. Never literal album art, but always intentional and beautiful. Breaks the "it's the cover" promise but doesn't ship ugly.

Decision recorded after spike, locked before Phase 4.

### AlbumAscii rendering

```tsx
<AsciiCanvas
  target={parsedGridFromServer}
  resolveOnMount
  resolveOnChange                  // re-resolve on track change
  wavePeriodMs={5200}              // synced with wordmark
  waveAngle="tr-bl"                // mirror of wordmark
  waveBehavior="brighten"
  glowIntensity={0.5}              // halved — 48×48 of glow is too much
  color="var(--fg-peak)"
  className="text-[10px] sm:text-[12px] leading-[1.05]"
/>
```

Mobile: scale to 32×32 grid (server route returns smaller grid for mobile UA, or client downsamples). Confirmed not "maybe" — 48×48 at 320px viewport is too dense.

### Track metadata

- Line 1: `Track Name — Artist Name`. Mono Neon, 16px, `--fg-peak`.
- Line 2: progress bar + time. Mono Neon, 13px, `--fg-muted`.

### Progress bar

**Simple block chars only — no ramp transitions.** Reserves the full ramp for art elements (wordmark, album art).

```
███░░░░░░░░░░░  2:14 / 4:03
```

15 chars wide. `█` for filled, `░` for empty. Single transition cell at the head can use `▒` for visual smoothing if it improves the read — test both. Updates every 1s client-side via optimistic increment between server polls.

### Idle state

Always renders at 48×48 (no CLS on data load). When Spotify reports nothing playing in last 5 min:

- Album grid renders the **signature glyph** (see below)
- Metadata reads "last played: Track Name — Artist Name · 4 hours ago"
- After 24h of silence: collapses to "currently silent"

### Signature glyph (specified now)

A circular density gradient using AsciiField vocabulary chars (`· : - = + * #`). Denser at the perimeter, lighter at center. Reads as "the system is listening, just nothing right now." 48×48 grid, hand-designed once, committed as a static string at `lib/ascii/signature.ts`.

Sketch:
```
##*+=-:::::::-=+*##
#*+=-::::::::-=+*#
*+=-::::::::::-=+*
+=-:::::::::::::=+
=-:::::::::::::-=
-::::::: ·:::::::-
:::::::: · ::::::::
        ·  ·
:::::::: · ::::::::
-::::::· :::::::-
=-:::::::::::::-=
+=-:::::::::::=+
*+=-::::::::::-=+*
#*+=-::::::::-=+*#
##*+=-:::::::-=+*##
```

(Final design tweaked once, committed.)

### Spotify pipeline

Single-user model — Taylor's refresh token in env. Visitors don't authenticate. One-time setup:

1. Create app at developer.spotify.com
2. Auth with scope `user-read-currently-playing user-read-recently-played`
3. Exchange code for refresh_token
4. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` on Vercel
5. Document in `docs/spotify-setup.md`

Server route `/api/now-playing`:
- Refresh access token (cached in-process, expires_in - 60s)
- Try currently-playing endpoint
- Fall back to recently-played if nothing active
- Convert album art to ASCII grid (cached by track ID, in-memory Map)
- Return `{ status: "playing" | "recent" | "silent", track, artist, progressMs, durationMs, playedAtMs, ascii }`

Client polls every 30s via SWR. Optimistic progress increment between polls. On track-id mismatch → triggers `resolveOnChange` on AlbumAscii.

### Files

```
app/api/now-playing/route.ts
lib/spotify.ts                          ← token refresh + endpoint fetchers
lib/ascii/image-to-grid.ts              ← sharp-based conversion (server-only)
lib/ascii/signature.ts                  ← idle-state static glyph
lib/ascii/cache.ts                      ← in-memory Map<trackId, ascii>
components/now-playing/NowPlaying.tsx
components/now-playing/ProgressBar.tsx
docs/spotify-setup.md
```

---

## 6. Wave choreography (synced)

```
t=0      first import → AsciiCanvas global clock starts
t=5.2    wordmark wave fires (tl-br, brighten)
         album wave fires (tr-bl, brighten)
         BOTH at the same instant
t=10.4   both wave again, simultaneously
t=15.6   both again
...
```

The two waves are struck like the same note on two instruments. They travel across their respective grids in mirror directions. Visually: the album shimmer travels right→left while the wordmark shimmer travels left→right, both starting and ending in lockstep.

Glow synchronization: both compute their own `glow` value from the shared clock. Wordmark uses `glowIntensity={1}`; album uses `glowIntensity={0.5}`.

Reduced motion: all AsciiCanvas instances render fully resolved on mount, no wave, no glow. ProgressBar still ticks (it's information). Footnote tooltips fade without inking.

---

## 7. Colophon footer

Single line, replaces the original spec'd footer.

```
Taylor Allen · 2026 · monaspace · next.js · no analytics · taylor@taylorallen.dev
```

- Mono Neon, 11px, `--fg-quiet`
- `·` separators in `--fg-quietest`
- Email is real `mailto:`
- 64px top, 32px bottom padding
- Wraps gracefully on mobile

The build credits (`monaspace · next.js · no analytics`) are the only addition over HANDOFF's spec. They replace the killed `/colophon` sub-page idea — same signal, one line, costs nothing. Voice-coded ("no analytics" is a plant-flag statement).

---

## 8. 404 page

Per HANDOFF — keep simple, don't over-invest.

```
404 — this page didn't ship
← back to taylorallen.dev
```

Centered. Mono Neon 14px `--fg-strong` line, 12px `--fg-muted` link below. Optional v2: render the wordmark glitched (using the unused `waveBehavior="downstep"` mode). Skip for v1.

---

## 9. Mobile (full parity, redesigned not degraded)

Touch is not a degraded mouse. Every desktop interaction gets a real touch equivalent. The mobile site must feel as alive as the desktop site, not like a static port.

### Translation table

| Desktop interaction              | Mobile equivalent                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Cursor halo on wordmark          | **Touch halo** — drag finger across wordmark, cells brighten under finger; fades 600ms after touch end |
| Cursor halo on album art         | **Touch halo** on AlbumAscii grid — same drag-to-brighten behavior                 |
| RegTicks snap on hover           | Snap on `touchstart` of the wordmark cluster, return on `touchend`                 |
| Custom `▌` block cursor          | N/A on touch — replaced by active-press brightening on interactive elements       |
| Footnote tooltip on hover        | Tap to expand **inline panel** below bio; tap word again or outside to dismiss     |
| Footnote marker discoverability  | First marker (`startups`) underline always visible in `--fg-muted` (more visible than desktop's `--fg-quietest`); other markers underline on tap |
| Email link hover state           | Active-press brightens to `--fg-peak`, returns on release                          |
| ScrambleLink hover scramble      | Plays once on first viewport entry instead of on hover (Intersection Observer)    |

### Touch halo implementation

Same code path as cursor halo. Listen for `touchstart`, `touchmove`, `touchend`. Convert touch coordinates to grid coordinates same as mouse. The masked overlay `<pre>` reads `--mx`/`--my` CSS variables — those get set from either pointer source. ~10 lines of new code.

Halo persistence on touch: ~600ms after `touchend`, halo fades to nothing. On desktop the halo follows the cursor continuously; on mobile it's an "I touched here" pulse. Different feel, intentional.

### Sizing across breakpoints

| Element               | <640px      | 640–768px   | 768–1024px  | >1024px     |
| --------------------- | ----------- | ----------- | ----------- | ----------- |
| Wordmark font-size    | 9px         | 14px        | 18px        | 22–26px     |
| Bio max-width         | 90vw        | 58ch        | 58ch        | 58ch        |
| Bio font-size         | 15px        | 16px        | 17px        | 17px        |
| Album grid            | 32×32       | 40×40       | 48×48       | 48×48       |
| Album font-size       | 9px         | 11px        | 12px        | 13px        |
| ProgressBar width     | 12 chars    | 15 chars    | 15 chars    | 15 chars    |
| NowPlaying section    | ~60vh       | ~55vh       | ~50vh       | ~50vh       |
| Footer                | wraps to 2 lines | wraps to 2 lines | one line | one line |
| AsciiField cell size  | 11px        | 12px        | 13px        | 13px        |

### Mobile-specific perf

- **Album grid is 32×32 on mobile** — server route reads `User-Agent` (or accepts `?size=32`) and conditionally returns smaller grid. Less data, less paint.
- **AsciiField churn rate halved on mobile** — battery preservation. 12 cells / 640ms instead of 6 cells / 320ms.
- **Substrate shader fallback on mobile** — Paper Shaders' StaticMeshGradient is GPU-heavy on lower-end Android. Pre-render to a 1080×1920 WebP at build time and use as `background-image` on `<body>` for `<768px`. Test on iPhone SE / mid-range Android.
- **`prefers-reduced-data` respected** — if the visitor has data-saver enabled, skip Spotify polling beyond initial load and skip the substrate shader.

### Mobile gestures NOT added (keep scope tight)

- No swipe-to-skip-track (we don't control playback)
- No pull-to-refresh (page polls every 30s; manual refresh is fine)
- No pinch-to-zoom on album art (browser-native is enough)
- No haptics (overkill for a personal site)

### Real-device QA gate

Phase 5 includes testing on **two real devices** before merge:
- iPhone SE or iPhone 12 mini (smallest viable iOS viewport)
- Mid-range Android (Pixel 5 / Galaxy A-series)

Not just Chrome devtools. Real touch, real network, real GPU.

---

## 10. Performance — threaded through every phase

Performance is not a Phase 6 cleanup task. Each phase has perf gates that must pass before merging. Final Lighthouse run is a verification, not a discovery.

### Bundle budget

| Item                            | Estimated gz size |
| ------------------------------- | ----------------- |
| Existing baseline               | ~60KB             |
| AsciiCanvas primitive           | net ~0 (replaces Wordmark internals) |
| Footnote system + Radix Tooltip | +5KB              |
| NowPlaying + ProgressBar        | +3KB              |
| SWR client                      | +5KB              |
| **Total estimated**             | **~73KB**         |

Hard ceiling: 100KB gz. `sharp` is server-only, never shipped to client.

### Per-phase perf gates

**Phase 0 — Baseline measured.**
- Capture: current bundle size, current Lighthouse mobile score, current LCP/CLS/INP, current Wordmark animation frame rate.
- Save baseline numbers to `docs/perf-baseline.md`. Every later phase compares against this.

**Phase 1 — Refactor.**
- Bundle delta: ≤ +1KB gz (refactor should be ~0 net, +1KB tolerance for boilerplate)
- Wordmark animation: 60fps on desktop, ≥50fps on iPhone SE
- `document.hidden` correctly pauses rAF (verified via Performance recording)
- **Add font preload** in `app/layout.tsx`'s `<head>` for Neon Regular/Medium + Xenon Regular. Don't wait for Phase 6.

**Phase 2 — Footnotes.**
- Bundle delta: ≤ +5KB gz (Radix Tooltip + Footnote components)
- Tooltip ink-in animation: 60fps on desktop, ≥50fps on mobile
- No CLS when tooltip opens (positioned absolutely, no document reflow)
- Mobile inline panel expansion: animated height transition, no layout flash

**Phase 2.5 — Conversion spike.**
- Server route warm response: <300ms (cache hit)
- Server route cold response: <2.5s (uncached, requires sharp conversion)
- Memory: sharp instance disposed after each conversion, no leaks across requests
- Selected algorithm documented + perf characteristics in `docs/album-conversion-decision.md`

**Phase 3 — Spotify route.**
- Token refresh cached in-process (no refresh on every request)
- ASCII grid cached by track ID (in-memory `Map`)
- Image fetch with timeout (5s) + abort signal — no hung requests
- Endpoint warm response: <250ms (data + cached ASCII)
- Endpoint cold response: <3s (data + Spotify fetch + image fetch + sharp conversion)

**Phase 4 — NowPlaying client.**
- Bundle delta: ≤ +8KB gz (NowPlaying + ProgressBar + SWR)
- **CLS = 0** — section renders at full height before first paint of data. Skeleton shows signature glyph + placeholder metadata at exact final dimensions.
- Wave pulses don't cause jank: AsciiCanvas string updates are batched with `requestAnimationFrame`, not committed per cell
- AlbumAscii at 48×48 should not cause layout thrash — measured via Performance panel
- SWR poll backs off on focus loss; resumes on focus

**Phase 5 — Polish + perf audit.**
- Substrate shader benchmarked on iPhone SE / mid-range Android. Fallback to pre-rendered WebP if frame rate <50fps or paint time >12ms.
- IntersectionObserver pause: AsciiField churn pauses when AsciiField is fully off-screen (long scroll cases). Wave loops continue (cheap).
- `prefers-reduced-data` respected (skip polling, skip shader)
- Real-device QA on iPhone SE + mid-range Android — both must hit ≥50fps during wave pulses
- All animations pause on `document.hidden` (verified)

**Phase 6 — Final Lighthouse + deploy.**
- Lighthouse mobile preset: 100/100/100/100. Anything <100 blocks deploy until fixed.
- LCP < 1.0s on Slow 4G throttle
- CLS = 0 verified across all states (loading, playing, idle, recent)
- INP < 200ms on all interactions
- TBT < 100ms
- Total transferred: < 200KB on initial load (HTML + critical CSS + critical JS + fonts)

### Specific perf items

- Server caches: in-memory `Map<trackId, ascii>` per Vercel instance. Persists ~15 min before instance recycle. No KV for v1.
- Client poll: 30s for now-playing. SWR `dedupingInterval` 30s. Pause when tab hidden via `revalidateOnFocus: true`.
- Image fetch: streamed from Spotify CDN to sharp; abort if >2MB.
- Font preload: from Phase 1 onward.
- Substrate shader benchmark: from Phase 5 onward.
- Web Vitals reporting: optional `web-vitals` package logging to console in dev. Not shipped to production unless analytics added.

### Performance regression CI (optional, post-v1)

Long-term, add a GitHub Action that runs Lighthouse against PR previews and fails the check if Lighthouse mobile score drops >2 points or LCP regresses >100ms. Out of scope for v1 but documented for v1.5.

---

## 11. Build order (every phase is deployable; perf gates baked in)

### Phase 0 — Branch + baseline (30 min)
- Branch `feat/v1-arc`
- Screen recording of current hero animation as regression baseline
- Capture perf baseline → `docs/perf-baseline.md` (bundle size, Lighthouse mobile score, LCP/CLS/INP, Wordmark frame rate on desktop + iPhone SE)
- Confirm `pnpm typecheck && pnpm lint && pnpm build` clean on `main`

### Phase 1 — Refactor + font preload (5–7 hr) — invisible
1. Pure helpers → `lib/ascii/{ramp,wave,clock}.ts`
2. Build `components/ascii/AsciiCanvas.tsx`
3. Migrate Wordmark to compose AsciiCanvas + halo + echo
4. **Add `<link rel="preload">` for Neon Regular/Medium + Xenon Regular in `app/layout.tsx`'s `<head>`**
5. Add **touch halo** support to Wordmark (touchstart/touchmove/touchend → same `--mx`/`--my` CSS vars; 600ms fade after touchend)
6. Visual diff against baseline — pixel-identical on desktop
7. Touch halo verified on real device (or Chrome devtools touch emulation as minimum)
8. Unit tests for `lib/ascii/*`
9. **Perf gate: bundle delta ≤ +1KB; 60fps desktop / ≥50fps iPhone SE; document.hidden pauses rAF**

**Ships:** nothing visible. Hero looks identical. Mobile gets touch halo. Foundation set.

### Phase 2 — Bio footnotes (5 hr) — first visible win
10. Static footnote content in `lib/footnotes.ts` (real copy confirmed with Taylor)
11. `components/footnote/Footnote.tsx` — Radix Tooltip + AsciiCanvas content (desktop)
12. `components/footnote/FootnoteContent.tsx` — char-grid renderer for project info
13. **Mobile: inline expanding panel variant** (not a floating tooltip; `details/summary` semantic + animated height)
14. Footnote markers: `--fg-muted` desktop, `--fg-strong` mobile; first word's underline always visible
15. Wrap three words in Hero.tsx bio
16. Keyboard accessibility audit (Tab order, Enter/Space, Escape)
17. **Perf gate: bundle delta ≤ +5KB; tooltip 60fps desktop / ≥50fps mobile; CLS = 0 on tooltip open; mobile panel animated height transition smooth**

**Ships:** the bio becomes the portfolio. If everything past this phase fails, the site already does the job it needs to.

### Phase 2.5 — Album conversion spike (3–4 hr) — research, no UI
18. `lib/ascii/image-to-grid.ts` (server-side, sharp) — implement (a) luminance, (b) Atkinson dither, (c) Sobel edges
19. **Test against 20 covers from Taylor's actual Spotify library** at both 48×48 and 32×32
20. Side-by-side render in a throwaway `app/dev/conversion-test/page.tsx` route
21. Pick algorithm by evidence; if all three fail >60% of test set: implement (d) deterministic fingerprint generator
22. Decision + perf characteristics → `docs/album-conversion-decision.md`
23. **Perf gate: server warm response <300ms (cache hit); cold response <2.5s; sharp instance disposal verified, no memory leak across 50 sequential conversions**

**Ships:** nothing user-visible. Phase 4 de-risked.

### Phase 3 — Spotify auth + server route (3 hr)
24. One-time manual auth flow: create Spotify app, generate refresh_token
25. `docs/spotify-setup.md` — reproducible setup doc
26. Env vars locally + on Vercel
27. `lib/spotify.ts` — token refresh (in-process cached), currently-playing fetcher, recently-played fetcher
28. `app/api/now-playing/route.ts` — orchestrate fetch + ASCII conversion + caching
29. `lib/ascii/signature.ts` — hand-designed 48×48 idle glyph (also generate 32×32 mobile variant)
30. **Mobile size handling: route accepts `?size=32` or detects mobile UA**
31. `lib/ascii/cache.ts` — in-memory `Map<trackId, { 48: string, 32: string }>` cache
32. Verify with curl across all states (playing / recent / silent) at both sizes
33. **Perf gate: warm endpoint <250ms; cold <3s; image fetch timeout 5s + abort signal verified**

**Ships:** API endpoint works. No UI yet.

### Phase 4 — NowPlaying client (4–5 hr)
34. `components/now-playing/ProgressBar.tsx` — simple `█/░` blocks, 12 chars mobile / 15 chars desktop
35. `components/now-playing/NowPlaying.tsx` — section header + AlbumAscii + metadata
36. SWR poll setup (30s); pauses on tab hidden, resumes on focus
37. `resolveOnChange` wiring on track-id mismatch (full re-resolve animation)
38. Optimistic progress increment between polls (1Hz tick)
39. **Skeleton state at exact final dimensions** — section renders at full height before data loads, with signature glyph as placeholder. CLS = 0.
40. **Touch halo on AlbumAscii** — same code path as wordmark touch halo
41. Mount in `app/page.tsx` between Hero and Footer
42. Mobile responsive: 32×32 grid <640px; 40×40 at 640–768px; 48×48 above
43. Tune mirrored wave geometry on desktop + mobile devices
44. **Perf gate: bundle delta ≤ +8KB; CLS = 0 verified across all loading states; wave pulses 60fps desktop / ≥50fps mobile; no jank on track-change re-resolve**

**Ships:** scroll past hero, see ASCII album art for current track on every device class.

### Phase 5 — Polish + real-device QA (3 hr)
45. Reduced-motion audit across all AsciiCanvas instances + Footnote + ProgressBar + halo
46. **Substrate shader benchmark on iPhone SE + mid-range Android.** If <50fps or paint >12ms: pre-render to 1080×1920 WebP at build time, swap to `background-image` for `<768px`.
47. **`prefers-reduced-data` respected** — skip Spotify polling beyond first load, skip substrate shader
48. AsciiField churn rate halved on mobile (`<768px` query)
49. IntersectionObserver pause for AsciiField when fully off-screen
50. `document.hidden` pauses ALL animations (verified per-component)
51. Colophon footer (one line with build credits, wraps to 2 lines on mobile)
52. 404 page (basic, no glitch effect for v1)
53. Tab title oscillation when blurred
54. HTML source comment (`<!-- you found the source. drop me a line. -->`)
55. **Real-device QA: iPhone SE/12 mini + mid-range Android.** Both must hit ≥50fps during wave pulses. Real touch interactions verified. Real network (4G throttle).
56. **Perf gate: 50fps minimum on real devices during steady-state animation; touch halo registers within 50ms of touchstart**

**Ships:** site is fully cohesive across desktop and mobile.

### Phase 6 — Final Lighthouse + deploy (2 hr)
57. **Lighthouse mobile preset run — 100/100/100/100 mandatory or block deploy**
58. LCP < 1.0s on Slow 4G throttle
59. CLS = 0 verified
60. INP < 200ms on all interactions
61. TBT < 100ms
62. JS budget verification: < 100KB gz total
63. Initial transfer < 200KB
64. Vercel project + env vars + domain attach
65. OG image (1200×630 PNG of TAYLOR wordmark — generate via headless screenshot of hero at OG dimensions)
66. `metadata.openGraph` + `metadata.twitter` in `app/layout.tsx`
67. `robots.txt` + `sitemap.xml` (Next 16 metadata file conventions)
68. Verify deployed Vercel build matches local Lighthouse score within 2 points
69. Real-device verification on prod URL

**Ships:** v1 is live.

**Total: ~25 hr** (~3 hr more than prior plan due to mobile parity + threaded perf gates). Each phase remains independently deployable.

---

## 12. Open product decisions (still need confirmation)

- **Domain:** `taylorallen.dev` hardcoded. Confirm.
- **Footnote copy:** the three project entries. Final text on each, especially the current build description (currently `[current build] · ai · llm tooling · early, in the dirt`).
- **Spotify privacy:** use Spotify's "Private session" feature when listening to anything you'd rather not broadcast.
- **Idle thresholds:** 5min playing→recent, 24h recent→silent. Tweakable.
- **Track filtering:** server-side denylist for podcasts/specific artists? Recommend yes for podcasts at minimum.
- **Mobile album size:** 32×32 confirmed. Test on real device before locking.
- **Album conversion algorithm:** decided after Phase 2.5 spike, not now.

---

## 13. Tradeoffs explicitly chosen

| Decision                                       | Alternative                       | Why                                                            |
| ---------------------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| Synced wave heartbeats                          | Offset phase (prior plan)        | Sync = confidence move. Offset = nervous, more motion.        |
| Mirrored geometry (tl-br vs tr-bl)              | Same direction                    | Provides visual distinction without breaking sync             |
| Hand-rolled image-to-ASCII (sharp)              | aalib.js / image-to-ascii libs    | Token integration, design control, zero added client JS       |
| Server-side conversion                          | Client-side canvas                | Tiny payload (string only), cache by track ID                 |
| Day-1 conversion spike                          | Trust luminance mapping           | Album art quality is a real product risk; evidence first      |
| Bio footnotes as portfolio                      | Selected Work table               | No fake projects, paragraph stays prose, curiosity rewarded   |
| Discovery seed underline on first footnote      | All markers identical             | Prevents feature dying invisible                               |
| Radix Tooltip foundation                        | Aceternity AnimatedTooltip        | Aceternity's is for avatars; Radix is the right primitive     |
| Mobile = quieter, not parity                    | Match desktop interactivity       | Hover-driven design doesn't have a mobile equivalent worth shipping in v1 |
| Killed StatusFlare                              | GitHub or Vercel deploy flare     | NowPlaying is the alive signal; second one is noise           |
| Colophon footer with build credits              | HANDOFF's plain footer            | Replaces /colophon idea in one line                           |
| Progress bar uses simple blocks                 | Density ramp                      | Reserves ramp for art elements                                 |
| Sync-only AsciiCanvas API                       | API owns halo + echo too          | Smaller surface, consumers compose                             |
| Bio footnotes ship before Spotify               | Spotify first                     | Footnotes are independent + low-risk; gives momentum if music stalls |

---

## 14. Risks and mitigations

| Risk                                              | Mitigation                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ASCII album art looks ugly on most covers         | Phase 2.5 spike — pick algorithm by evidence; fallback to fingerprint if all algorithms fail |
| Refactor regresses hero animation                 | Visual diff against pre-refactor screenshot; pixel-identical or revert                    |
| Footnotes are too invisible to discover           | Discovery seed underline on first footnote; markers in `--fg-muted` not `--fg-quietest`  |
| Footnotes are too visible (compromise prose feel) | Test by reading the bio; if eye snags vs. glides, adjust                                  |
| Spotify API hiccups break NowPlaying              | Graceful fallback chain: playing → recent → silent + signature glyph                      |
| Album art licensing concerns                      | Personal site, low scale — Spotify's developer terms allow display "as provided"; ASCII derivative is on the edge but standard practice |
| Mobile experience feels degraded                  | Accept it for v1; tap-to-expand footnotes is the only added mobile interaction            |
| Sync-only waves feel monotonous                   | If feedback says so, can re-introduce phase offset. Cheap to flip back.                   |
| AsciiCanvas API doesn't generalize                | Ship with one consumer (refactored Wordmark) before building NowPlaying — validate the API on the existing case first |

---

## 15. Out of scope for v1

- `/now`, `/writing`, `/reading`, `/uses`, `/about`, `/colophon` sub-pages
- StatusFlare (any variant)
- Selected Work table
- Beat-synced wave (Spotify audio-features → BPM)
- Cmd+K command palette
- Konami code easter egg
- Marquee with banned-words list
- Aceternity Spotlight
- 404 wordmark glitch (waveBehavior="downstep" mode kept in pocket)
- Print stylesheet (deferred to v1.1)
- Performance regression CI (Lighthouse-on-PR action — deferred to v1.1)
- Mobile gestures: swipe-to-skip, pull-to-refresh, pinch-to-zoom, haptics (intentionally not added)

---

## 16. Definition of done

**Foundation**
- [ ] Phase 0: perf baseline captured in `docs/perf-baseline.md`
- [ ] Phase 1: Hero animation pixel-identical to pre-refactor baseline
- [ ] Phase 1: Touch halo works on Wordmark on real touch device
- [ ] Phase 1: Font preload in `<head>`

**Footnotes (the portfolio replacement)**
- [ ] Phase 2: Three bio footnotes ink in on hover with Radix tooltip + AsciiCanvas content
- [ ] Phase 2: Mobile inline-expand panel works on real device
- [ ] Phase 2: Discovery seed underline visible on `startups`
- [ ] Phase 2: Tab/Enter/Escape keyboard nav verified

**Album conversion + Spotify**
- [ ] Phase 2.5: Conversion algorithm selected with evidence (`docs/album-conversion-decision.md`)
- [ ] Phase 2.5: 20-cover test gallery rendered side-by-side
- [ ] Phase 3: `/api/now-playing` returns valid JSON in all three states (playing/recent/silent)
- [ ] Phase 3: Endpoint serves both 48×48 (desktop) and 32×32 (mobile) grids
- [ ] Phase 3: Signature glyph hand-designed in both sizes

**NowPlaying client**
- [ ] Phase 4: NowPlaying renders ASCII album art for currently-playing track
- [ ] Phase 4: Track changes trigger full resolve sequence
- [ ] Phase 4: Wordmark + AlbumAscii waves struck simultaneously, mirrored geometry
- [ ] Phase 4: Section renders at full height before data load (CLS = 0)
- [ ] Phase 4: Touch halo works on AlbumAscii on real touch device
- [ ] Phase 4: ProgressBar uses simple block chars, scales 12→15 chars across breakpoints
- [ ] Phase 4: Mobile uses 32×32 grid; desktop uses 48×48

**Mobile parity**
- [ ] Phase 1+: Touch halo on Wordmark
- [ ] Phase 2+: Footnote inline-expand on tap
- [ ] Phase 4+: Touch halo on AlbumAscii
- [ ] Phase 5+: AsciiField churn halved on mobile
- [ ] Phase 5+: Substrate shader benchmarked; fallback to WebP on mobile if needed
- [ ] Phase 5+: `prefers-reduced-data` respected
- [ ] Phase 5+: Real-device QA on iPhone SE + mid-range Android, ≥50fps during animation

**Polish**
- [ ] Phase 5: All animations respect `prefers-reduced-motion`
- [ ] Phase 5: All animations pause on `document.hidden`
- [ ] Phase 5: Custom `▌` cursor on interactive elements (desktop only)
- [ ] Phase 5: Colophon footer with build credits
- [ ] Phase 5: 404 page
- [ ] Phase 5: Tab title oscillation when blurred
- [ ] Phase 5: HTML source comment

**Perf — final**
- [ ] Phase 6: Lighthouse 100/100/100/100 on mobile preset
- [ ] Phase 6: Total JS shipped < 100KB gz
- [ ] Phase 6: LCP < 1.0s on Slow 4G
- [ ] Phase 6: CLS = 0
- [ ] Phase 6: INP < 200ms
- [ ] Phase 6: TBT < 100ms
- [ ] Phase 6: Initial transfer < 200KB

**Ship**
- [ ] Phase 6: Vercel deployment with custom domain
- [ ] Phase 6: OG image (1200×630)
- [ ] Phase 6: `metadata.openGraph` + `metadata.twitter`
- [ ] Phase 6: `robots.txt` + `sitemap.xml`
- [ ] Phase 6: Prod Lighthouse score within 2 points of local
- [ ] Phase 6: Real-device verification on prod URL
