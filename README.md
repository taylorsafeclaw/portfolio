# taylorallen.dev

Personal site. Single page. Dark, monochrome, all-monospace. The whole page is a living ASCII density field — content doesn't sit on top of it, it emerges from it.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind CSS v4 (config lives in `app/globals.css` via `@theme`)
- Raw `requestAnimationFrame` for the ASCII field, CSS animations for reveals, Motion (`motion/react`) for spring physics where needed
- Monaspace (Neon + Xenon), self-hosted via `next/font/local`
- pnpm · deployed on Vercel

## Commands

```bash
pnpm dev        # localhost:3000
pnpm build      # production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm format     # prettier write
```

Run `pnpm typecheck && pnpm lint && pnpm build` before declaring work done.

## Project map

```
app/                  layout, page, 404, globals
components/
  ascii/              AsciiGrid canvas (site-wide breathing field)
  hero/               Wordmark + ScrambleLink + hero composition
  story/              Story section + TextGenerate component
  work/               SelectedWork + WorkCard (focus cards)
  conviction/         Conviction section (scroll-paced belief statements)
  footer/             Footer with magnetic CTA
  shared/             HeaderDecode, BorderBeam, SectionWrapper
  ui/                 shadcn primitives (re-skinned)
lib/
  ascii/              density.ts, ramp.ts, scramble.ts, intro.ts
  hooks/              useReducedMotion, useInView, useMagnetic
  projects.ts         project data
public/fonts/         Monaspace woff2 files
```

No `pages/` directory. No barrel files. Server Components by default; `'use client'` only for state, refs, browser APIs, animations.

## What's built

- Hero: TAYLOR wordmark animation (resolve + wave + scanline), bio, ScrambleLink CTAs
- ASCII field: site-wide breathing canvas with cursor halo, density sparkles, breathing waves
- Shared primitives: `lib/ascii/density.ts` (breathing, sparkle, erosion math), `useInView`, `HeaderDecode`, `TextGenerate`, `BorderBeam`

## What's coming

- Story section (narrative, text generate)
- Work section rewrite (focus cards with spotlight + moving border)
- Conviction section (scroll-paced belief statements)
- Footer rewrite (magnetic CTA, "Let's build something.")
- AsciiGrid moved site-wide with density erosion per section
- Mobile and reduced motion passes
- Cleanup and deploy

Full task list in `TODOS.md`. Full spec in `docs/superpowers/specs/2026-05-24-interactive-resume-design.md`.

## Design rules (non-negotiable)

Decided. Don't re-litigate.

1. Dark only. No light mode.
2. Monochrome only. The warm off-white (`--fg-peak`) is a brightness step, not an accent.
3. Monaspace only. Neon for everything, Xenon for section headers.
4. ASCII as the visual identity. The density ramp (`· ░ ▒ ▓ █`) is the design system.
5. Restraint over flex. No glow, gradient borders, 3D, aurora, bento grids.
6. Performance is part of the design. LCP < 1s, CLS = 0, Lighthouse 95+, < 150KB JS.

If a change would violate any of these, push back — don't silently comply.

## Docs

- **`docs/superpowers/specs/2026-05-24-interactive-resume-design.md`** — design + implementation source of truth. All 12 effects, section specs, responsive behavior, performance budget.
- **`TODOS.md`** — task checklist, what's done vs pending.
- **`CLAUDE.md`** — operating instructions for Claude Code sessions on this repo.
- **`AGENTS.md`** — Next.js 16 caveats (APIs differ from training data; check `node_modules/next/dist/docs/`).
- **`HANDOFF.md`** — archived original design spec. Superseded by the new spec above.
