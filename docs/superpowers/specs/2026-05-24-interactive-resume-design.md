# taylorallen.dev — Interactive Resume Design Spec

Replaces HANDOFF.md as the source of truth. Everything in this document is decided.

---

## What this is

A single-page interactive resume for Taylor Allen — 22, repeat founder, builder, applying to founding eng and full-stack roles at startups. The site itself is a portfolio piece. The craft of the site demonstrates the craft Taylor brings.

**The one-sentence pitch:** A breathing ASCII field that you can touch, where content emerges through density erosion, text crystallizes from noise, work entries respond to your attention, and the whole thing compresses to a quiet close.

**Audience:** Startup founders, hiring managers, fellow operators. People who move fast and pattern-match on taste. They spend 30-60 seconds on a portfolio. The site needs to earn every second.

**What the visitor should feel:** "This person builds living systems that reward attention."

---

## Aesthetic direction

**Tone:** Engineered restraint. Not brutalist — too cold. Not luxury — too precious. This is the aesthetic of a builder who cares about the parts other people skip. Closest references: Aino's ASCII-as-surface philosophy, Linear's dark density and craft obsession, Resend's atmospheric editorial confidence.

**The unforgettable thing:** The entire page is a living ASCII field. Content doesn't sit on top of it — content emerges from it. Every interaction speaks one visual language: the density ramp (·░▒▓█). Nothing on this site looks like it came from a component library because everything is repurposed through this single primitive.

---

## Stack

- **Framework:** Next.js 16+ (App Router), React 19, TypeScript strict
- **Styling:** Tailwind CSS v4, CSS variables for design tokens
- **Animation:** Raw requestAnimationFrame for the ASCII field, CSS animations for reveals, Motion (`motion/react`) only if spring physics are needed
- **Fonts:** Monaspace Neon (default), Monaspace Xenon (section headers only), self-hosted woff2
- **Package manager:** pnpm
- **Deployment:** Vercel

No new dependencies without justification. Every dependency is a perf cost.

---

## Design tokens

```css
:root {
  /* Ink scale */
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

  /* Foreground */
  --fg-brightest: #f4f1ea;
  --fg-strong: var(--ink-900);
  --fg: var(--ink-800);
  --fg-muted: var(--ink-700);
  --fg-quiet: var(--ink-600);
  --fg-quietest: var(--ink-500);
  --fg-peak: var(--fg-brightest);

  /* Density ramp */
  --density-ramp: '· ░ ▒ ▓ █';

  /* Type */
  --font-mono: 'Monaspace Neon', ui-monospace, 'JetBrains Mono', monospace;
  --font-display: 'Monaspace Xenon', ui-monospace, monospace;
  --font-serif: 'Instrument Serif', Georgia, 'Times New Roman', serif;
}
```

---

## Typography

Monospace everywhere — with one deliberate exception.

- **Default:** Monaspace Neon, weight 400
- **Emphasis:** Monaspace Neon, weight 500, color --fg-peak
- **Section headers:** Monaspace Xenon, 13px, weight 400, letter-spacing 0.04em, lowercase
- **Body:** 16-17px, line-height 1.75
- **Detail text:** 11-12px, --fg-muted or --fg-quiet
- **Conviction statements:** Instrument Serif italic, 18-20px, weight 400. The ONE non-monospace moment on the entire page. Used only for the 2-3 belief statements in the Conviction section. The shift from mono to serif signals: "this is what I believe, not what I built." The contrast commands attention precisely because the rest of the page is monospace.

**Font loading:** Self-host Instrument Serif woff2 via `next/font/local` (or Google Fonts import). Only load the italic cut — regular weight is not used.

---

## Page structure

Five sections, scrollable, single page:

```
1. Hero          — TAYLOR wordmark, bio, CTAs (built)
2. Story         — narrative "who I am" (2-3 sentences)
3. Work          — selected projects as interactive cards
4. Conviction    — 2-3 strong beliefs, one per scroll beat
5. Contact       — email CTA, location, year
```

---

## The density ramp system

The density ramp `· ░ ▒ ▓ █` is the design system. Every visual effect on the page is an expression of characters moving through this ramp:

- **Appearing:** Characters climb the ramp (·→░→▒→▓→█→letterform)
- **Dimming:** Characters descend the ramp (letterform→█→▓→▒→░→·→gone)
- **Brightening:** Characters jump up the ramp (cursor proximity, hover)
- **Breathing:** Characters oscillate gently within a narrow ramp range
- **Eroding:** Characters descend and disappear, clearing space for content

This unifies every effect into one visual language.

---

## The 12 effects

### Identity layer (always active)

**01 · Breathing Field**
The ASCII grid rendered at ~10% opacity with slow sinusoidal warmth waves. Characters are felt, not read. The canvas everything lives on. Tune the existing AsciiGrid — drop churn visibility, add wave-based opacity modulation.

**02 · Cursor Halo**
Already built. Characters near cursor climb the ramp and brighten. 140px radius. Works everywhere on the page, not just the hero.

**03 · Density Sparkles**
Inspired by Aceternity Sparkles. Random characters in the field briefly flash up the ramp (·→▒→·) and settle back over ~400ms. 2-3 per second across the viewport. What makes the field feel organic vs. mechanical.

### Scroll layer (content entrance)

**04 · Density Erosion**
Inspired by Aceternity Canvas Reveal (inverted). As each section scrolls into view, ASCII characters erode outward from where content will appear. Characters descend the ramp (█→▓→▒→░→·→gone), clearing space. Different erosion geometry per section:
- Story: center-out (curtains opening)
- Work: top-down (revealing)
- Conviction: edges-in (focusing)
- Contact: bottom-up (settling)

Characters at the margins remain, breathing. Content lives in a clearing, not on a blank canvas.

**05 · Header Decode**
Inspired by MagicUI HyperText. Section headers scramble through density ramp characters on scroll-in, then resolve to readable text over ~300ms. Extends the existing ScrambleLink pattern from hover-triggered to viewport-triggered via IntersectionObserver.

**06 · Text Generate**
Inspired by Aceternity Text Generate Effect. Narrative body text materializes word by word on scroll, paced to reading speed (~80ms per word). Each word briefly flashes through the density ramp (░→▒→letterform) before resolving. Used in Story and Conviction sections.

### Card layer (work entries)

**07 · Focus Cards**
Inspired by Aceternity Focus Cards. Hovering one work entry dims the others. Non-focused cards: text drops to --fg-quietest, border characters descend the ramp. Focused card: text stays at --fg-strong, border characters climb. Not gaussian blur — density-based dimming using the ramp.

**08 · Card Spotlight**
Inspired by Aceternity Card Spotlight. Cursor creates a density gradient on the focused card's surface. A mini version of the cursor halo scoped to the card interior. Background characters in the card climb the ramp near cursor position. Reveals subtle texture in the card.

**09 · Moving Border**
Inspired by Aceternity Moving Border. A density character (▓) orbits the focused card's perimeter on a 3-4 second loop. Not a glowing pixel — an ASCII character walking the border. Stops when the card loses focus.

### Closing layer

**10 · Magnetic CTA**
Inspired by Aceternity Magnetic Button. The email link drifts toward the cursor on proximity (~200px activation radius, ~4px max drift). Nearby ASCII characters in the breathing field also drift — they're pulled toward the CTA. The invitation to reach out has physical gravity.

**11 · Footer Gravity**
Already built in scroll-store. ASCII field densifies at the bottom — characters climb the ramp as you approach the end. The page compresses to a close.

### Connective layer

**12 · Border Beam**
Inspired by MagicUI Border Beam. A density character (░) travels the hairline divider between sections, left to right, on a slow loop (~6 seconds). Marks transitions between thoughts. Uses --fg-quietest color.

---

## Section specs

### Section 1: Hero (built)

Layout: Centered composition, min-h-screen, overflow-hidden, px-6 sm:px-10. The wordmark animation, bio, and CTAs are production-grade and staying as-is.

**Changes from current state:**
- Tune AsciiGrid ambient opacity from ~25% to ~10%
- Add breathing wave modulation (sinusoidal, ~7s period)
- Add density sparkles (2-3/sec, subtle)
- Cursor halo already works — ensure it extends below the hero

**Bio (needs refresh — Taylor to approve):**
Current version: "Hi, I'm Taylor. Builder from the Bay. Repeat founder. Shipped startups from 0 → 1, gone deep on enterprise systems, now back to building. Mostly drawn to the parts other people skip, where taste compounds."

Suggested update to reflect Odisai and self-taught positioning:
> Hi, I'm Taylor. Self-taught builder from the Bay. **Repeat founder.** Built my first startup's MVP at 19, got it into PearX. Most recently took an AI voice-agent platform from zero to paying customers — solo, end-to-end. Drawn to the parts other people skip.

**CTAs:**
- `selected work →` — scrolls to Work section
- `taylor@taylorallen.dev` — mailto link with ScrambleLink

### Section 2: Story

Purpose: The narrative "who I am." 2-4 sentences in first person. Plain language, concrete, no buzzwords.

**Layout:** Centered, max-width 52ch, generous padding (pt-24 sm:pt-32).

**Copy (draft — Taylor to finalize):**
> I started my first company at 19 — sole engineer, built the MVP, got it into PearX. Went deep on healthcare AI at Stanford, then co-founded an AI voice-agent platform and took it from zero to paying customers. Self-taught, no degree. **I keep shipping the parts other people skip.**

**Effects:**
- Density erosion (center-out) clears the ASCII field as section enters
- Text Generate reveals words one by one on scroll
- Key phrase (bold text) appears through a slightly slower ramp climb

**Section header:** `about` — Monaspace Xenon, 13px, decoded via Header Decode

### Section 3: Work

Purpose: Selected projects as interactive cards. Placeholder content for v1, designed so real content drops in later.

**Layout:** Max-width 64ch, centered. Cards stacked vertically with hairline dividers.

**Each card contains:**
- Density indicator on left edge (█ = featured/exited, ▓ = significant, ▒ = current/in-progress)
- Project title — --fg-strong, weight 500, 14px
- One-line description — --fg-muted, 12px
- Year range — --fg-quiet, 11px, right-aligned

**Project data (v1):**
```
█  odisai                                    2025 — 2026
   co-founded an AI voice-agent platform for vet clinics.
   built end-to-end solo. 5 paying customers live in production.

▓  stanford health care                      2024 — 2025
   solutions architect, AI. built an internal clinical
   note-taking tool. contributed to ChatEHR pilot.

▒  poppin                                    2021 — 2022
   sole engineer on a social events app. built the MVP
   in two months. pear-backed. ~$2M seed. exited.
```

**Effects:**
- Header Decode on "selected work"
- Cards stagger-reveal on scroll (existing pattern, 120ms delay per card)
- Focus Cards: hover dims non-focused entries
- Card Spotlight: density gradient follows cursor on focused card
- Moving Border: ▓ orbits focused card perimeter

**Section header:** `selected work` — Monaspace Xenon, 13px, decoded

### Section 4: Conviction

Purpose: 2-3 strong beliefs. Each statement lives on its own scroll beat. This is the "why me" without saying "why me."

**Layout:** Centered, max-width 44ch, 80-100px vertical spacing between statements.

**Copy (draft — Taylor to finalize):**
> I keep starting things.

> The best products come from people who care about **the details nobody asked them to care about.**

> Self-taught since high school. No degree. **Everything I know, I learned by shipping.**

**Effects:**
- Density erosion (edges-in) for section entrance
- Text Generate reveals each statement word by word
- Generous scroll pacing — one thought at a time
- Bold phrases appear through slower ramp climb

**Section header:** None. The statements speak for themselves. No label needed.

### Section 5: Contact

Purpose: Simple close. Email, location, year. Warm, alive.

**Layout:** Centered, pt-16 pb-8.

**Content:**
```
Let's build something.

taylor@taylorallen.dev

Taylor Allen · 2026 · Bay Area
```

**Effects:**
- Footer Gravity: field densifies as you approach bottom
- Magnetic CTA on email link
- ScrambleLink on email hover (existing)
- "Let's build something." appears via Text Generate
- Footer info (name · year · location) in --fg-quiet, 11px

---

## Responsive behavior

### Desktop (1024px+)
Full experience. All 12 effects active. Content at max-width constraints. Cursor halo and card interactions at full fidelity.

### Tablet (768px — 1023px)
- Wordmark scales down (responsive font sizes already built)
- Work cards maintain layout, touch replaces hover for focus/spotlight
- Card spotlight disabled (no persistent cursor on touch)
- Moving border still runs on focused card (tap to focus)
- Cursor halo disabled, touch halo on tap with 600ms fade

### Mobile (< 768px)
- Wordmark at smallest breakpoint (~9px)
- Bio max-width: 90vw
- CTAs stack vertically with 16px gap
- Work cards: tap to focus, no spotlight, no moving border
- Breathing field at reduced resolution (larger character cells, fewer total cells)
- Density sparkles reduced to 1/sec
- ASCII field churn rate reduced for battery
- Text Generate still works (scroll-triggered)
- Density erosion simplified (uniform fade-in instead of shaped erosion)
- Border beam still runs
- Footer gravity still works
- Magnetic CTA disabled on touch

### Reduced motion (`prefers-reduced-motion: reduce`)
- Breathing field renders one static frame, no animation loop
- No cursor halo, no sparkles
- No density erosion — sections fade in with simple opacity transition
- No header decode — headers render immediately
- No text generate — text appears immediately
- No moving border, no border beam
- Focus cards still dim/brighten (CSS transition, not animation)
- Card spotlight disabled
- Footer gravity disabled (static field)
- ScrambleLink shows plain text

---

## Performance budget

- LCP < 1.0s on fast 3G
- CLS = 0
- Total JS shipped: < 150KB gzipped (interaction-heavy page, but monitor and optimize)
- Lighthouse: 95+ on all four metrics (100 target)
- ASCII field: requestAnimationFrame with frame budget (~16ms). Skip frames if behind. Pause on document.hidden.
- Sparkles: use the existing churn timer, not a separate rAF loop
- Card interactions: CSS transitions where possible, JS only for density ramp calculations

---

## Accessibility

- All text meets WCAG AA contrast (--fg on --bg is well above 4.5:1)
- Full `prefers-reduced-motion` support (see above)
- Semantic HTML: `<main>`, `<section>` per section, `<h2>` for section headers
- Tab order: Hero CTAs → Work cards → Contact email
- Focus states: 1px solid --fg-muted outline, 4px offset
- ASCII field is `aria-hidden`
- All interactive elements keyboard-accessible
- Work cards focusable via tab (trigger focus state on keyboard focus, not just hover)

---

## What's NOT in v1

- Sub-pages (/about, /writing, /uses, /now)
- Real project screenshots or images
- Dither shader, ASCII art component (needs real images)
- Sticky scroll reveal (needs deep-dive content)
- Blog, writing section
- Analytics (decision pending)
- Light mode, accent colors, non-Monaspace fonts

---

## Open decisions (flag when encountered)

- [ ] Domain name (taylorallen.dev assumed)
- [ ] Final copy for Story section
- [ ] Final copy for Conviction section (2 or 3 statements?)
- [ ] Real email address for mailto
- [ ] OG image design
- [ ] Whether to add Plausible analytics

---

## Non-negotiable rules

1. Dark only. No light mode.
2. Monochrome only. No accent color. --fg-peak is brightness, not accent.
3. Monaspace only. Neon default, Xenon headers.
4. ASCII as visual identity. The density ramp is the design system.
5. Every effect must speak the density ramp language.
6. Performance is part of the design.
7. `prefers-reduced-motion` must be respected everywhere.
8. No component used as-is from any library. Everything reskinned through the ramp.
