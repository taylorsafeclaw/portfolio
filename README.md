# taylorallen.dev

Personal site. Single page. Dark, monochrome, all-monospace, ASCII as visual identity.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind CSS v4 (config lives in `app/globals.css` via `@theme`)
- Motion (`motion/react`) for animation
- Paper Shaders for the substrate
- Monaspace (Neon + Xenon), self-hosted via `next/font/local`
- pnpm · deployed on Vercel

## Commands

```bash
pnpm dev        # localhost:3000
pnpm build      # production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
```

Run `pnpm typecheck && pnpm lint && pnpm build` before declaring work done.

## Project map

```
app/                  layout, page, 404, globals
components/
  hero/               Wordmark + AsciiField + GridLayer + ScrambleLink (the signature moment)
  substrate/          site-wide Paper Shaders mesh
  ui/                 shadcn primitives (re-skinned)
lib/                  cn() helper
public/fonts/         Monaspace woff2 files
```

No `pages/` directory. No barrel files. Server Components by default; `'use client'` only for state, refs, browser APIs, animations.

## Docs

- **`HANDOFF.md`** — design + implementation source of truth. Tokens, voice, hero spec, work/footer/404 specs, performance budget. Read this before changing anything visual.
- **`TODOS.md`** — outstanding work for v1, open decisions, deploy checklist.
- **`CLAUDE.md`** — operating instructions for Claude Code sessions on this repo.
- **`AGENTS.md`** — Next.js 16 caveats (APIs differ from training data; check `node_modules/next/dist/docs/`).

## Design rules (non-negotiable)

Decided. Don't re-litigate.

1. Dark only. No light mode.
2. Monochrome only. The warm off-white (`--fg-peak`) is a brightness step, not an accent.
3. Monaspace only. Neon for everything, Xenon for section headers.
4. ASCII as the visual identity. No SVG logo, no photo, no emoji.
5. Restraint > flex. No glow, gradient borders, 3D, aurora, bento grids.
6. Performance is part of the design. LCP < 1s, CLS = 0, Lighthouse 100s, < 100KB JS.

If a change would violate any of these, push back — don't silently comply.
