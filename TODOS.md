# TODOS

Source of truth for v1 execution. Mirrors phase structure in `plan.md`. Defer to `plan.md` for design intent and `HANDOFF.md` for tokens / fonts / voice.

Each phase ends with `pnpm typecheck && pnpm lint && pnpm build` clean and its perf gate satisfied. No phase ships if it regresses the previous one.

---

## Phase 0 — Branch + baseline (30 min)

- [ ] Create branch `feat/v1-arc`
- [ ] Screen-record current hero animation (10s loop) → save to `docs/baseline-hero.mov`
- [ ] Capture perf baseline → `docs/perf-baseline.md`:
  - [ ] Current bundle size (`pnpm build` output)
  - [ ] Lighthouse mobile score (Performance / Accessibility / Best Practices / SEO)
  - [ ] LCP, CLS, INP, TBT
  - [ ] Wordmark animation frame rate on desktop (Chrome) + iPhone SE (real or emulated)
- [ ] `pnpm typecheck && pnpm lint && pnpm build` clean on `main`

---

## Phase 1 — Refactor to `<AsciiCanvas>` + font preload + touch halo (5–7 hr)

### Refactor
- [ ] `lib/ascii/ramp.ts` — `RAMP` constant, `rampForProgress(p)`
- [ ] `lib/ascii/wave.ts` — `buildWaveBoost`, `easeOutCubic`, `smoothstep`
- [ ] `lib/ascii/clock.ts` — module-level shared epoch (`performance.now()` on first import)
- [ ] `components/ascii/AsciiCanvas.tsx` — primitive component (resolve + wave + single `<pre>`)
  - [ ] Accept `target`, `ramp`, `resolveOnMount`, `resolveOnChange`, `wavePeriodMs`, `waveAngle`, `waveBehavior`, `glowIntensity`, `color`, `className`, `ariaLabel`
  - [ ] Subscribe to `prefers-reduced-motion`
  - [ ] Pause rAF on `document.hidden`
  - [ ] Expose `glow` value via CSS variable for sibling overlays to read
- [ ] Refactor `components/hero/Wordmark.tsx` to compose `<AsciiCanvas>` + halo `<pre>` + echo `<pre>`
- [ ] Visual diff Wordmark vs. baseline screen recording — pixel-identical or revert

### Touch halo (mobile parity)
- [ ] Add `touchstart`, `touchmove`, `touchend` listeners on Wordmark wrapper
- [ ] Convert touch coords to grid coords (same as mouse path)
- [ ] Halo `<pre>` reads same `--mx` / `--my` CSS variables
- [ ] 600ms fade-out after `touchend`
- [ ] Verify on real touch device (or Chrome devtools touch emulation as minimum)

### Font preload (don't wait for Phase 6)
- [ ] `<link rel="preload" as="font" type="font/woff2" crossOrigin>` in `app/layout.tsx`'s `<head>`:
  - [ ] MonaspaceNeon-Regular.woff2
  - [ ] MonaspaceNeon-Medium.woff2
  - [ ] MonaspaceXenon-Regular.woff2

### Tests + perf gate
- [ ] Unit tests for `lib/ascii/ramp.ts` and `lib/ascii/wave.ts` (deterministic helpers)
- [ ] **Bundle delta ≤ +1KB gz**
- [ ] **60fps desktop / ≥50fps iPhone SE during steady-state**
- [ ] **`document.hidden` pauses rAF (verified via Performance recording)**

---

## Phase 2 — Bio footnotes (5 hr) — first visible win

### Content
- [ ] `lib/footnotes.ts` — three structured entries (poppin, stanford health, current build)
- [ ] Confirm copy for each footnote with Taylor (especially current build description)

### Components
- [ ] `components/footnote/Footnote.tsx`
  - [ ] Desktop: Radix UI `Tooltip` reskinned to mono / `--bg-elev-1` / 1px hairline border
  - [ ] Mobile (`<768px`): inline expanding `<details>`/animated panel below paragraph
  - [ ] Marker: `¹ ² ³` Unicode superscripts in `--fg-muted` (desktop) / `--fg-strong` (mobile)
  - [ ] Hover target = whole word; word gets hairline underline on hover
  - [ ] First word (`startups`) has permanent faint underline as discovery seed (more visible on mobile)
- [ ] `components/footnote/FootnoteContent.tsx` — char-grid renderer using `<AsciiCanvas resolveOnMount>` for the inking effect
  - [ ] Density char prefix: `█` (current), `▓` (recent), `▒` (older)
  - [ ] Title in `--fg-strong` weight 500; body in `--fg`; tag (`exited`) in `--fg-quiet`
- [ ] Wrap three words in `components/hero/Hero.tsx` bio paragraph

### Accessibility
- [ ] Footnoted words use `<button>` semantics
- [ ] Tab order: `startups → enterprise systems → building → email`
- [ ] Enter/Space opens; Escape closes
- [ ] Focus state: same hover underline + `▌` block prefix

### Perf gate
- [ ] **Bundle delta ≤ +5KB gz**
- [ ] **60fps desktop / ≥50fps mobile during tooltip ink-in**
- [ ] **CLS = 0 on tooltip open** (positioned absolutely)
- [ ] **Mobile inline panel — animated height transition, no layout flash**

---

## Phase 2.5 — Album conversion spike (3–4 hr) — research, no UI

- [ ] `lib/ascii/image-to-grid.ts` — implement three candidates:
  - [ ] (a) Plain luminance → ramp
  - [ ] (b) Atkinson dither → ramp
  - [ ] (c) Sobel edge detection → 1-bit → ramp
- [ ] Throwaway test page `app/dev/conversion-test/page.tsx`:
  - [ ] Side-by-side render of 20 covers from Taylor's actual Spotify library at 48×48 and 32×32
- [ ] Pick algorithm by visual evidence
- [ ] If all three lose >60% of test set: implement (d) deterministic fingerprint generator (hash track ID → seeded ASCII pattern)
- [ ] Decision + rationale + perf characteristics → `docs/album-conversion-decision.md`
- [ ] Delete throwaway test route after decision

### Perf gate
- [ ] **Server warm response <300ms (cache hit)**
- [ ] **Server cold response <2.5s (with sharp conversion)**
- [ ] **Sharp instance disposal verified — no leaks across 50 sequential conversions**

---

## Phase 3 — Spotify auth + server route (3 hr)

### One-time auth (manual)
- [ ] Create Spotify app at developer.spotify.com
- [ ] Add `https://taylorallen.dev/api/spotify-callback` + `localhost:3000/api/spotify-callback` redirect URIs
- [ ] Generate auth URL with `user-read-currently-playing user-read-recently-played` scopes
- [ ] Exchange code for `refresh_token` (one-time curl)
- [ ] Set env vars locally + on Vercel:
  - [ ] `SPOTIFY_CLIENT_ID`
  - [ ] `SPOTIFY_CLIENT_SECRET`
  - [ ] `SPOTIFY_REFRESH_TOKEN`
- [ ] `docs/spotify-setup.md` — reproducible setup doc

### Server code
- [ ] `lib/spotify.ts`:
  - [ ] `refreshAccessToken()` (in-process cache, expires_in - 60s)
  - [ ] `getCurrentlyPlaying()`
  - [ ] `getRecentlyPlayed()`
- [ ] `lib/ascii/cache.ts` — `Map<trackId, { 48: string, 32: string }>`
- [ ] `lib/ascii/signature.ts` — hand-design 48×48 idle glyph (and 32×32 mobile variant)
- [ ] `app/api/now-playing/route.ts`:
  - [ ] Try currently-playing → fall back to recently-played → fall back to silent
  - [ ] Convert album art (size based on `?size=32` query or mobile UA)
  - [ ] Return `{ status, track, artist, progressMs, durationMs, playedAtMs, ascii }`
  - [ ] Image fetch with 5s timeout + abort signal
  - [ ] Sharp instance disposed after use

### Verify
- [ ] `curl localhost:3000/api/now-playing` returns valid JSON, all three states
- [ ] `curl localhost:3000/api/now-playing?size=32` returns 32-row grid
- [ ] **Warm endpoint <250ms; cold <3s**
- [ ] **Image fetch timeout fires correctly on slow URL**

---

## Phase 4 — NowPlaying client (4–5 hr)

### Components
- [ ] `components/now-playing/ProgressBar.tsx`
  - [ ] Simple `█` / `░` blocks (no ramp)
  - [ ] 12 chars mobile / 15 chars desktop
  - [ ] 1Hz client-side optimistic increment
  - [ ] Time format: `M:SS / M:SS`
- [ ] `components/now-playing/NowPlaying.tsx`
  - [ ] Section header `now playing` (Monaspace Xenon, 13px, lowercase)
  - [ ] AlbumAscii using `<AsciiCanvas>`:
    - [ ] `wavePeriodMs={5200}`, `waveAngle="tr-bl"`, `waveBehavior="brighten"`, `glowIntensity={0.5}`
    - [ ] `resolveOnChange={true}` — re-resolves on track change
  - [ ] Track metadata (line 1): `Track — Artist` in `--fg-peak`
  - [ ] Track metadata (line 2): ProgressBar + time in `--fg-muted`
  - [ ] Idle state: signature glyph + "last played: ... · 4h ago"
- [ ] Mount in `app/page.tsx` between `<Hero />` and `<Footer />`

### Polling + state
- [ ] SWR setup, `dedupingInterval: 30000`, `revalidateOnFocus: true`
- [ ] Track-id mismatch detection → trigger re-resolve
- [ ] Optimistic progress increment: `progressMs + (now - lastPoll)`
- [ ] Pause polling on `document.hidden`

### CLS = 0 / skeleton state
- [ ] Section renders at full final height before any data loads
- [ ] Skeleton shows signature glyph at exact final dimensions
- [ ] Metadata lines render with reserved height even when empty

### Mobile parity
- [ ] AlbumAscii: 32×32 at `<640px`, 40×40 at `640–768px`, 48×48 above
- [ ] Touch halo on AlbumAscii (same code path as Wordmark touch halo)
- [ ] Section height: ~60vh mobile, ~50vh desktop

### Perf gate
- [ ] **Bundle delta ≤ +8KB gz**
- [ ] **CLS = 0 verified across all loading states**
- [ ] **Wave pulses 60fps desktop / ≥50fps mobile**
- [ ] **No jank on track-change re-resolve**

---

## Phase 5 — Polish + real-device QA (3 hr)

### Reduced-motion + visibility
- [ ] All `<AsciiCanvas>` instances render fully resolved when `prefers-reduced-motion: reduce`
- [ ] Footnote tooltips fade without inking under reduced motion
- [ ] All rAF loops pause on `document.hidden` (verify per-component)

### Substrate shader fallback
- [ ] Benchmark Paper Shaders `StaticMeshGradient` on iPhone SE / mid-range Android
- [ ] If <50fps or paint >12ms on mobile:
  - [ ] Pre-render to `public/substrate-fallback.webp` at build time (1080×1920)
  - [ ] Swap to `background-image` for `<768px` viewport

### Mobile-specific perf
- [ ] AsciiField churn rate halved on mobile (`<768px` matchMedia)
- [ ] IntersectionObserver pause on AsciiField when fully off-screen
- [ ] `prefers-reduced-data` → skip Spotify polling beyond first load + skip shader

### Polish elements
- [ ] Custom `▌` block cursor on interactive elements (desktop hover only)
- [ ] Tab title oscillation on blur: `TAYLOR ▒░░ → ░▒░ → ░░▒ → ...`
- [ ] HTML source comment in root layout
- [ ] Colophon footer (one line, build credits)
- [ ] 404 page (`app/not-found.tsx`) — basic version per HANDOFF spec

### Real-device QA gate
- [ ] iPhone SE / 12 mini — wave pulses ≥50fps, touch halo registers <50ms
- [ ] Mid-range Android (Pixel 5 or Galaxy A) — same gates
- [ ] Real network 4G throttle — page interactive <2s
- [ ] All footnote interactions work via touch (no orphan hover-only behavior)

---

## Phase 6 — Final Lighthouse + deploy (2 hr)

### Lighthouse — block deploy if any score <100
- [ ] Performance: 100
- [ ] Accessibility: 100
- [ ] Best Practices: 100
- [ ] SEO: 100

### Web Vitals on Slow 4G
- [ ] LCP < 1.0s
- [ ] CLS = 0
- [ ] INP < 200ms
- [ ] TBT < 100ms

### Bundle
- [ ] Total JS gz < 100KB
- [ ] Initial transfer < 200KB

### Deploy
- [ ] Vercel project linked
- [ ] Env vars set on production
- [ ] Custom domain attached + DNS verified
- [ ] OG image: 1200×630 PNG of TAYLOR wordmark (generate via headless screenshot)
- [ ] `metadata.openGraph` + `metadata.twitter` in `app/layout.tsx`
- [ ] `robots.txt` (Next 16 metadata file convention)
- [ ] `sitemap.xml` (Next 16 metadata file convention)

### Production verification
- [ ] Prod URL Lighthouse within 2 points of local
- [ ] Real-device verification on prod URL (iOS + Android)
- [ ] `/api/now-playing` returns valid data on prod
- [ ] Spotify token refresh works on prod (let it run >1hr to verify)

---

## Decisions still open (do not block, but answer before relevant phase)

- [ ] **Domain confirmed** — `taylorallen.dev` hardcoded in mailto + footer
- [ ] **Footnote copy** for current build (³) — needs final text from Taylor
- [ ] **Spotify privacy** — confirm Taylor uses "Private session" for tracks he wouldn't broadcast
- [ ] **Idle thresholds** — 5min (playing→recent), 24h (recent→silent). Confirm or override
- [ ] **Track filtering** — server-side podcast denylist? Specific artists?

---

## Out of scope for v1 (do not start)

- StatusFlare (any variant)
- Selected Work table
- Sub-pages (`/now`, `/writing`, etc.)
- Beat-synced wave (Spotify audio-features)
- Cmd+K command palette
- Konami code easter egg
- Marquee
- Aceternity Spotlight
- 404 wordmark glitch
- Print stylesheet
- Performance regression CI
- Mobile gestures beyond tap (swipe, pull-to-refresh, pinch, haptics)

---

## Quick reference

| Need to know       | Where                                       |
| ------------------ | ------------------------------------------- |
| Design intent      | `HANDOFF.md`                                |
| v1 architecture    | `plan.md`                                   |
| Tokens / fonts     | `HANDOFF.md` §"Design tokens" + `app/globals.css` |
| Perf baseline      | `docs/perf-baseline.md` (after Phase 0)     |
| Album conversion   | `docs/album-conversion-decision.md` (after Phase 2.5) |
| Spotify setup      | `docs/spotify-setup.md` (after Phase 3)     |
