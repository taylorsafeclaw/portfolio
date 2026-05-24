# Claude design

https://api.anthropic.com/v1/design/h/7zWLlHDnPDQeegVVIt6GjQ?open_file=Hero.html

# Personal Site — Implementation Handoff

This document is the complete spec for building **taylorallen.dev** (or whatever the final domain is) — a single-page personal site for Taylor Allen, a 22-year-old repeat founder and builder from the Bay Area.

The design system, voice, and creative direction are locked. This doc is the bridge from design to production code.

---

## Project context

**Who.** Taylor Allen — 22, Bay Area, repeat founder, currently building. Co-founded and CTO'd Poppin (Pear-backed, exited), spent time as enterprise architect at Stanford Health, now building in AI/LLMs.

**What.** A minimal, dark, all-monospace single-page personal site with a distinctive ASCII identity and an emphasis on craft. Audience is recruiters, founders, fellow operators.

**Why this doc exists.** The design system was generated in Claude Design and the visual direction is locked. We need production code that uses real, performant component libraries and respects every decision in the system without re-litigating any of them.

---

## Stack

- **Framework.** Next.js 15+ with App Router, React 19, TypeScript
- **Styling.** Tailwind CSS v4 (or v3 if v4 has compat issues), CSS variables for design tokens
- **Animation.** Motion (formerly Framer Motion) — `motion/react`
- **Fonts.** Monaspace family (Neon for default, Xenon for editorial moments) — self-hosted woff2 from GitHub's Monaspace repo
- **Deployment.** Vercel
- **Package manager.** pnpm

Avoid: Material UI, Chakra, anything with prebuilt theming systems. We have our own.

---

## Component libraries

```bash
pnpm add motion @paper-design/shaders-react
```

### Paper Shaders — `StaticMeshGradient` (used in `components/substrate/Substrate.tsx`)
The site-wide material substrate. Dark canvas with imperceptible warm atmospheric drift. Actual implementation:

```tsx
<StaticMeshGradient
  colors={["#0a0a0a", "#0c0b09", "#09090b", "#0b0a0a"]}
  waveX={0.35}
  waveY={0.35}
  mixing={1}
  grainOverlay={0.08}
  style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
/>
```

Static — renders once. If perf becomes an issue, pre-render to a high-res image at build time and use as `background-image` instead.

### Hero — custom build (no React Bits)
The wordmark and field are hand-built ASCII renderers, not React Bits `ASCIIText`. We needed finer control over the resolve sequence, the diagonal sheen wave, per-cell ramp behavior, and the cursor halo than React Bits' prop surface allowed. See "Hero — full spec" below for the actual architecture.

### Cult UI — `DitherImage` (later, for project case studies)
For project thumbnails when case studies land. Not needed for v1.

### Aceternity — `Spotlight` (installed, unused)
Lives at `components/ui/spotlight.tsx`. Available if a single subtle hover-spotlight earns its place. Default purple gradient must be replaced with a near-white radial before use.

---

## Design tokens (from the design system)

Set these as CSS variables on `:root`. They came from the published design system in Claude Design.

```css
:root {
  /* Ink scale — twelve neutral steps, cool deep, warm peak */
  --ink-000: #050505;
  --ink-050: #0a0a0a;
  --ink-100: #111111;
  --ink-150: #161616;
  --ink-200: #1c1c1c;
  --ink-300: #262626;
  --ink-400: #3a3a3a;
  --ink-500: #5a5a5a;
  --ink-600: #7a7a7a;
  --ink-700: #9a9a9a;
  --ink-800: #c8c6c2;
  --ink-900: #ebe8e2;

  /* Surfaces */
  --bg: var(--ink-050);
  --bg-elev-1: var(--ink-150);
  --bg-elev-2: var(--ink-200);
  --border: var(--ink-300);
  --border-strong: var(--ink-400);

  /* Foreground — six text registers */
  --fg-brightest: #f4f1ea;  /* iron-gallate ink, warm peak */
  --fg-strong: var(--ink-900);
  --fg: var(--ink-800);  /* default body */
  --fg-muted: var(--ink-700);
  --fg-quiet: var(--ink-600);
  --fg-quietest: var(--ink-500);
  --fg-peak: var(--fg-brightest);  /* alias for "the warm one" */

  /* Type scale (mono everywhere) */
  --font-mono: 'Monaspace Neon', ui-monospace, 'JetBrains Mono', monospace;
  --font-display: 'Monaspace Xenon', ui-monospace, monospace;  /* slab-serif mono — section headers ONLY */

  /* Density ramp (typographic weight primitive) */
  --density-light: '░';
  --density-mid: '▒';
  --density-strong: '▓';
  --density-full: '█';

  /* Spacing — character grid foundation */
  /* Horizontal dimensions in `ch` units when possible */
  /* Vertical rhythm in line-height multiples */
}
```

---

## Type system

**Hard rule.** Monospace everywhere. No sans-serif. No serif. No exceptions.

- **Default everything** — Monaspace Neon
- **Section headers ONLY** — Monaspace Xenon (slab-serif mono)
- Variation comes from weight (400, 500) and size only

**Font loading.** Self-host woff2 files from the official Monaspace repo. Use `next/font/local`:

```tsx
import localFont from 'next/font/local'

const monaspaceNeon = localFont({
  src: [
    { path: './fonts/MonaspaceNeon-Regular.woff2', weight: '400' },
    { path: './fonts/MonaspaceNeon-Medium.woff2', weight: '500' },
  ],
  variable: '--font-mono',
  display: 'swap',
})

const monaspaceXenon = localFont({
  src: [
    { path: './fonts/MonaspaceXenon-Regular.woff2', weight: '400' },
  ],
  variable: '--font-display',
  display: 'swap',
})
```

Fallback stack: `'Monaspace Neon', ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace`.

---

## Voice (governs all copy)

Anything you write or generate must match this voice. The bio is the canonical example; everything else should sound like it came from the same person.

**Persona.** 22yo founder/builder/engineer-with-taste from the Bay. Has shipped and exited; is currently building again. Plain English first. Operator vocabulary used as seasoning, never as the meal. Slightly funny in the dry, deadpan register — never stand-up, never cute.

**Banned words.** "passionate," "synergy," "leverage" (as verb), "robust," "scalable" (as filler), "cutting-edge," "revolutionary," "world-class."

**Sentence rules.** Lead with concrete nouns. Avoid hedging ("kind of," "I think maybe"). One opinion per page minimum. Contractions are okay. Don't apologize for or hedge AI work.

**Three calibration sentences.** New copy should feel at home next to:
1. *"I keep starting things."*
2. *"Built at Stanford Health between 2021 and 2023."*
3. *"Page not found. Something here didn't ship."*

---

## Page architecture (v1)

Single page, scrollable. Three sections:

1. **Hero** — above-the-fold, ASCII wordmark, bio, two CTAs
2. **Selected work** — short list of projects, mono table format
3. **Contact / footer** — email, location, year

That's the entire site for v1. Don't add a writing section, /about, /uses, or any sub-pages until there's content for them.

---

## Hero — full spec

The hero is the highest-stakes section and the source of truth for the site's visual language. The implementation in `components/hero/` is canonical — if this doc disagrees with the code, the code wins.

### Layout

- Centered composition, `min-h-screen`, `overflow-hidden`, horizontal padding `px-6 sm:px-10`
- Single centered cluster (wordmark → bio → CTAs) with `gap-12 sm:gap-14`
- The top-corner anchors described in the original spec ("Taylor Allen" top-left, "● currently building in san ramon" top-right) were dropped — the hero reads cleaner without them. Revisit only if they earn their place.

### Layered architecture (z-stacked, back to front)

1. **`Substrate`** (in `app/layout.tsx`, `position: fixed`, `z-index: -1`) — Paper Shaders mesh gradient, site-wide.
2. **`GridLayer`** (`components/hero/GridLayer.tsx`) — 88px square grid in `--bg-elev-1` at 22% opacity, masked by a radial gradient. ~2.2% of cells get a `--bg-elev-2` solid square that breathes on a 7s cycle (CSS `squareBreath` keyframe in `globals.css`).
3. **`AsciiField`** (`components/hero/AsciiField.tsx`) — full-viewport canvas of low-density ASCII (`· : - = + * #`) at 13px, biased toward lighter glyphs. A cursor halo (`HALO=130px`, `HALO_INNER=55px`) bumps glyphs up the ramp and brightens them as the mouse moves. Background churns 6 cells every 320ms. Uses an offscreen canvas for the base so only the halo region is recomputed per frame. Masked with a radial cutout so the field fades behind the wordmark.
4. **`Vignette`** — radial gradient overlay (`rgba(255,253,247,0.035)` core → black edges) for falloff.
5. **`Grain`** — inline SVG `feTurbulence` filter at 7% opacity, `mix-blend-overlay`. Static, no animation.
6. **`Wordmark`** + **`Scanline`** + **`RegTicks`** — the centered cluster (z-10).
7. **Bio paragraph + CTAs** — fade in after the wordmark resolves.

`AmbientDrift` exists in the folder but is not currently mounted — it's a particle drift overlay kept for optional reintroduction.

### The wordmark (`components/hero/Wordmark.tsx`)

Hand-built ASCII renderer. The word `TAYLOR` is encoded as a 6-row glyph map; each cell is animated independently via a single `requestAnimationFrame` loop. Two stacked `<pre>` elements: a faint offset "echo" for printed weight, plus the live mark in `--fg-peak` with a `textShadow` glow that swells in sync with the wave pulse.

Ramp: `· ░ ▒ ▓ █`. Color: `--fg-peak`. Font: `var(--font-mono)`. Sizes: `text-[14px] sm:text-[18px] md:text-[22px] lg:text-[26px]`.

### The animation sequence (canonical timings — see `Wordmark.tsx`)

| t (ms)        | event                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| 0             | Mount. All cells start blank.                                                              |
| 250           | **Appear phase.** Cells fade in as `░` in randomized order over ~1100ms.                   |
| 1470          | **Set phase.** Cells climb the ramp `░ → █` in randomized order over ~1100ms.              |
| 2570          | Wordmark fully inked. (`RESOLVE_DONE = 2570`; in `Hero.tsx` the visual cue is `t=2400ms`.) |
| 2500          | **Scanline** sweeps left → right across the wordmark over 1.4s (one-shot).                 |
| 2750          | **RegTicks** (corner crop marks) fade in over 700ms.                                       |
| 2600 / 2900   | **Bio** then **CTAs** fade up (`y: 6 → 0`, opacity 0 → 1, 600ms, custom ease).             |
| 7570 (+5000)  | **First wave.** Diagonal "sheen" pulse travels through the wordmark over ~1.7s, briefly down-stepping cells (`█ → ▓ → ▒`) along its band. `textShadow` swells synchronously. |
| every ~5200ms | Subsequent wave pulses. Off-grid interval so they never feel metronomic. Pauses on `document.hidden`. |

The wave is the wordmark's "breath" — replaces the original spec's "swap 2% of characters every 1400ms" shimmer, which read as random noise rather than intentional motion.

### Hover affordance — `RegTicks`

When the cursor enters the wordmark cluster, the four corner crop marks snap inward by 8px (220ms cubic-bezier). It's a quiet "the mark is targetable" cue without lighting the whole element up.

### Reduced motion

`Wordmark` checks `prefers-reduced-motion` via `useSyncExternalStore`. When set, it renders fully resolved on mount with no appear/set/wave animation. `AsciiField` skips its rAF loop and renders one static frame; the cursor halo is also disabled (no mouse listener engaged for animation). `ScrambleLink` short-circuits to plain text. Bio/CTA fade-ins still play (Motion respects reduced motion via its own defaults).

### The bio (centered below wordmark, max-width 58ch)

Style: `font-mono`, `text-[16px] sm:text-[17px]`, `leading-[1.75]`, color `--fg`. "Repeat founder." gets `font-medium` + `--fg-peak`.

Current copy (in `Hero.tsx`):
```
Hi, I'm Taylor. Builder from the Bay. Repeat founder. Shipped startups from 0 → 1, gone deep on enterprise systems, now back to building. Mostly drawn to the parts other people skip, where taste compounds.
```

The original spec had "Shipped a startup" — the live copy intentionally generalizes to "startups from 0 → 1" to cover both Poppin and the current build.

### The CTAs (`ScrambleLink`)

Two text-only `<a>`s rendered through `ScrambleLink` (`components/hero/ScrambleLink.tsx`). On hover/focus, the visible characters scramble through `· : - = + * # %` and resolve back to the label over 240ms (per-character unlock proportional to position). Reduced motion skips the scramble.

1. `selected work →` — `text-[15px]`, `--fg-peak`, links to `#selected-work`.
2. `taylor@taylorallen.dev` — `text-[15px]`, `--fg-muted`, real `mailto:` link.

Both share the `.hero-link` class for the underline treatment (defined in `globals.css`).

### What NOT to include
- No buttons with backgrounds (text-only CTAs)
- No glow effects, no drop shadows
- No 3D
- No icons except the dot in top-right and the `→` after "selected work"
- No emojis
- No gradient borders
- No bento grids
- No "scroll to explore" hint
- No skill chips, tech logos, language lists
- No tagline above the wordmark

### Mobile (<768px)
- Wordmark scales down to fit viewport with 24px horizontal padding (likely ~9px font-size)
- Top-left and top-right labels remain visible; if they overlap on very small screens, the right one (`currently building in...`) drops and the left one stays
- Bio max-width drops to 90% of viewport
- CTAs stack vertically with a 16px gap between them

---

## Substrate — site-wide

The `StaticMeshGradient` from Paper Shaders runs as a fixed-position element behind the entire site (not just the hero). It's the *atmosphere*.

```tsx
// app/layout.tsx
import { StaticMeshGradient } from '@paper-design/shaders-react'

<body>
  <StaticMeshGradient
    colors={['#0a0a0a', '#0f0d0a', '#0a0c10', '#0c0a0a']}
    distortion={0.6}
    swirl={0.2}
    speed={0}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
    }}
  />
  {children}
</body>
```

If perf becomes an issue (test on mobile and lower-end devices), pre-render to a 1920×1080 WebP at build time and use as `background-image` on `body` instead.

---

## Selected work — spec

Below the hero. Section header followed by a list of 2–4 projects in a mono table.

### Section header
- Text: `selected work`
- Font: `--font-display` (Monaspace Xenon, slab-serif mono)
- Size: 13px, weight 400, color `--fg-strong`
- Lowercase, letter-spacing 0.04em
- Spacing: 96px above, 32px below

### Project list (table format, no images, no cards)

Each row is a 3-column grid:
- Column 1 (~6ch): a density character indicator — `█` for active/featured, `▓` for current/recent, `▒` for archived. Color `--fg-muted`.
- Column 2 (flex): project title (color `--fg-strong`, weight 500) + one-line description (color `--fg-muted`, 11px, slightly indented below the title)
- Column 3 (~14ch): year + arrow link, right-aligned (color `--fg-quiet`, 11px)

```
█  poppin                                            2021 → 2023 →
   social events app · co-founder & cto · pear-backed
─────────────────────────────────────────────────────────────────
▓  [current project]                                       2026 →
   one-line description in the same voice as the bio
─────────────────────────────────────────────────────────────────
▒  [older project, optional]                                2024 →
   one-line description
```

Hairline divider (`--border`) between rows. Hover state: row gets a `--bg-elev-1` background, density character shifts to the next denser ramp step (`▒ → ▓`, `▓ → █`), 200ms ease.

**Note.** Don't list projects that don't exist. If there are only 2 real projects, list 2. Empty work sections are worse than short ones.

---

## Contact / footer — spec

Bottom of the page. Quiet, factual.

```
Taylor Allen · 2026 · Bay Area · taylor@[domain]
```

- All on one line on desktop, wraps gracefully on mobile
- Font: `--font-mono`, 11px
- Color: `--fg-quiet`
- Dot separator (`·`) in `--fg-quietest`
- Email is a real `mailto:` link
- 64px padding above, 32px below

No "thanks for visiting." No social icons. No newsletter signup.

---

## 404 page

```
404 — this page didn't ship
```

- Centered vertically and horizontally
- Same Monaspace Neon, 14px, color `--fg-strong`
- Below it, in `--fg-muted` 12px: a link back home — `← back to taylorallen.dev`

The line is doing voice work; don't soften it.

---

## Performance budget

This is non-negotiable for a frontend site that's also a craft showcase.

- LCP < 1.0s on a fast 3G connection
- CLS = 0 (no layout shift, ever)
- Total JS shipped: < 100KB gzipped
- Lighthouse score: 100/100/100/100 on all four metrics
- Sub-100ms route transitions (single-page so largely free, but verify)

**Specifically watch for:**
- The mesh shader can be expensive; benchmark on iPhone SE / mid-range Android. Fall back to static image if needed.
- The ambient shimmer loop should use `requestAnimationFrame` with throttling, not `setInterval`. Pause when tab is hidden.
- Self-host fonts; don't use Google Fonts CDN. Preload the woff2 files in `<head>`.

---

## Accessibility

- All text meets WCAG AA contrast minimum (verify `--fg` on `--bg` is at least 4.5:1 — should be fine)
- Focus states use a single-character cursor block (`▌`) treatment, not the default browser outline
- Respect `prefers-reduced-motion` everywhere (see Hero spec)
- All animations can be disabled
- Semantic HTML — `<main>`, `<nav>` if there's a nav, `<section>` for each section
- Alt text on any images (there shouldn't be many; project case studies later may have screenshots)
- Tab order makes sense
- Email link is accessible via keyboard

---

## Build order — current status

1. ~~Setup. Next.js + Tailwind + Monaspace fonts + tokens.~~ **Done.**
2. ~~Substrate. StaticMeshGradient site-wide.~~ **Done.**
3. ~~Hero composition (layout, bio, CTAs).~~ **Done.**
4. ~~Hero wordmark animation (resolve + wave + scanline + reg ticks).~~ **Done.**
5. **Mobile pass on hero.** Spot-check — wordmark size scales, padding holds, CTAs stack cleanly.
6. **Selected work section.** Mono table, real projects only. Hero links to `#selected-work` so this anchor is currently broken.
7. **Contact / footer.** One line.
8. **404 page** (`app/not-found.tsx`).
9. **Performance pass.** Lighthouse, font preload in `<head>`, mobile testing, substrate fallback if shader is heavy.
10. **Deploy to Vercel.**

Outstanding work tracked in `TODOS.md`.

---

## Things to *not* re-decide

These were settled. If something tempts you to revisit them, the answer is no.

- Dark mode only. No light mode toggle.
- Monochrome only. No accent color (the `--fg-peak` warm off-white is *not* an accent).
- Monaspace family only. No Inter, no Söhne, no serif.
- ASCII as the visual identity. No replacing it with a logo, an SVG, or a photo.
- The bio is locked. Don't rewrite it.
- The architecture is single-page. Don't add /about, /writing, /uses, /now until there's content.

---

## Reference materials

- Design system live preview: [link to the published Claude Design system]
- Voice doc: see "Voice" section above
- Component libraries: React Bits, Paper Shaders, Cult UI, Aceternity UI (as listed)
- Color palette: based on the published ink scale
- Fonts: https://github.com/githubnext/monaspace

---

## Final note

This is a *craft showcase site*. Every detail matters. Spacing should feel deliberate. Animations should feel earned. Performance should feel instant. If something feels generic — a default Tailwind hover state, a default focus ring, a default font fallback — fix it.

The visitor's first impression is the single hero animation. The second impression is whether the rest of the page lives up to it. Make sure both are right.