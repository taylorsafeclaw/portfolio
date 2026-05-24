@AGENTS.md

# CLAUDE.md

This file gives Claude Code persistent context for working on this codebase. Keep it tight; long files dilute attention.

## Always use the frontend-design skill

Any time you touch UI, components, layout, styling, or anything user-visible in this repo, invoke the `frontend-design` skill first. No exceptions, even for "small" tweaks. It governs how visual decisions get made here.

## What this project is

A single-page personal site for Taylor Allen — repeat founder, builder, currently working in AI. Stack: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Self-hosted on Vercel. Dark-mode-only, monochrome, all-monospace, with an ASCII-based visual identity.

The full design + implementation spec lives in `HANDOFF.md` — read it before making any design/UX decisions.

## Commands

- `pnpm dev` — start dev server on :3000
- `pnpm build` — production build (run before declaring work done)
- `pnpm lint` — eslint, must pass clean
- `pnpm typecheck` — tsc --noEmit, must pass clean
- `pnpm format` — prettier write

Always run `pnpm typecheck && pnpm lint` before finishing a task. Do not commit work that fails either.

## Stack specifics

- **Next.js 15+, App Router only.** No `pages/` directory. Server Components by default; mark `'use client'` only when needed (state, refs, browser APIs, animations).
- **TypeScript strict mode.** No `any`. No `// @ts-ignore`. If types are fighting you, the design is wrong, not the type.
- **Tailwind CSS v4.** No `tailwind.config.ts` — config lives in CSS via the `@theme` directive in `app/globals.css`. Design tokens are defined in `:root` and exposed to Tailwind via `@theme inline { --color-fg: var(--fg); ... }`. Use OKLCH not HSL for color values. Use `tw-animate-css` instead of the deprecated `tailwindcss-animate`.
- **shadcn/ui.** Components live in `components/ui/`. They're copy-pasted, not installed — when adding a new one, use `pnpm dlx shadcn@latest add [component]` and then *re-skin it to match the design system* (Monaspace, monochrome, no rounded-md defaults, no ring colors). Never use shadcn defaults as-is.
- **Animation.** Motion (`motion/react`), not framer-motion. Always wrap motion components in `'use client'`.
- **Fonts.** Monaspace family, self-hosted via `next/font/local`. Two faces: Neon (default) and Xenon (slab serif, section headers only). No other typefaces, ever.

## Project structure

```
app/
  layout.tsx          # Fonts, substrate, root metadata
  page.tsx            # Single-page site
  not-found.tsx       # 404
  globals.css         # Design tokens, @theme directive, base styles
components/
  ui/                 # shadcn primitives (re-skinned)
  hero/               # Hero section + ASCII wordmark + animation
  work/               # Selected work table
  footer/
lib/
  utils.ts            # cn() helper
public/
  fonts/              # Monaspace woff2 files
HANDOFF.md            # Full design spec — source of truth for visual decisions
CLAUDE.md             # This file
```

Keep section components in their own folders even if small — easier to extend later.

## Design system rules (non-negotiable)

These are decided. Don't re-litigate them.

1. **Dark only.** No light mode, no toggle.
2. **Monochrome only.** No accent color. The warm off-white (`--fg-peak`) is *not* an accent — it's a brightness step.
3. **Monaspace only.** Neon for everything, Xenon for section headers. No Inter, no serifs, no exceptions.
4. **ASCII as visual identity.** The hero wordmark, density-ramp echoes elsewhere. No SVG logo, no photo, no emoji.
5. **Restraint > flex.** No glow, no gradient borders, no 3D, no aurora, no bento grids. If it tempts you, the answer is no.
6. **Performance is part of the design.** LCP < 1s, CLS = 0, Lighthouse 100s. Sub-100KB JS. No exceptions.

If a request would violate any of these, push back and explain — don't silently comply.

## Voice (governs all copy)

When writing or generating any user-facing copy (UI strings, error messages, alt text, button labels, comments visible to users):

- Plain English first. Operator vocabulary (taste, compound, ship, bet, conviction) used as seasoning, never as the meal.
- First-person where natural. Contractions are fine.
- Concrete nouns over abstractions. "Hospital systems" not "enterprise environments."
- One opinion per page minimum.
- Banned: "passionate," "synergy," "leverage" (verb), "robust," "scalable" (filler), "world-class," "cutting-edge."

Calibration: new copy should feel at home next to *"I keep starting things"* / *"Page not found. Something here didn't ship."*

## How to work on this project

**Start with HANDOFF.md.** It's the source of truth for design and copy decisions. If your work intersects with anything visual or text-based, read the relevant section first. Don't rederive what's already decided.

**Make a plan before editing.** For non-trivial changes, sketch the approach in chat before touching files. Especially true for the hero animation — it has specific timing and interaction rules (see HANDOFF).

**Search before guessing.** If a token, component, or pattern might already exist, grep for it. We use `--fg`, `--bg-elev-1`, `--font-mono` etc. as CSS variables — don't introduce parallel naming.

**Component additions.** When adding a new shadcn component, immediately re-skin it: replace default colors with our tokens, replace `font-sans` with `font-mono`, soften default rounded corners (`rounded-md` becomes `rounded-sm` or removed), strip default ring colors. Then verify it actually fits the design before using it.

**Animation work.** All animations must respect `prefers-reduced-motion`. The hero wordmark has a specific sequence (resolve → settle → ambient shimmer) — implement it exactly as specified in HANDOFF, not approximately.

**Write tests if appropriate but don't over-test.** This is a personal site. Tests for the wordmark animation logic, type assertions, and any utility functions are welcome; don't write integration tests for "user clicks a link."

## File and code conventions

- **TypeScript over inference.** Prefer explicit prop types on components. Use `type` for unions/aliases, `interface` for object shapes that might be extended.
- **No barrel files (`index.ts`).** Import directly from the file. Faster builds, easier to grep.
- **Component naming.** PascalCase for component files (`Hero.tsx`), camelCase for utilities (`cn.ts`). One default export per component file.
- **CSS.** Tailwind utilities first. CSS variables for tokens. Component-scoped styles only when Tailwind genuinely can't do it.
- **Imports.** Use `@/` alias for absolute imports. Group: react/next first, third-party second, local third.
- **Comments.** Comment *why*, not *what*. The code shows what it does.

## Things to never do

- Add new fonts (any kind, anywhere)
- Add accent colors (any kind, anywhere)
- Add a light mode
- Add packages without justifying it (every dep is a perf cost)
- Use `'use client'` at the page level if a Server Component would work
- Use any shadcn component without re-skinning it first
- Add analytics that ship JS (Plausible's script is okay, GA4 is not)
- Hardcode hex values that should be tokens
- Bypass the design system because something is "easier"
- Write code that ships without `prefers-reduced-motion` handling
- Skip the `pnpm typecheck && pnpm lint` step before declaring a task done

## Things to push back on

- Requests to add a section/page without content to fill it ("/uses", "/about", "/writing" stay out until there's real content)
- Requests to make the hero "more impressive" — it's intentionally restrained
- Requests for emoji, sparkle effects, or generic SaaS landing-page tropes
- Requests to "just match" some other site without understanding what we're trying to do differently
- Anything that conflicts with HANDOFF.md

If the user asks for one of these, ask if they're sure and explain the tradeoff. Don't just comply.

## Iteration patterns I prefer

- Show me a plan before writing a lot of code
- One task at a time; don't try to ship the whole site in one PR
- After a substantive change, run `pnpm typecheck && pnpm lint && pnpm build` and report results before moving on
- For visual changes, take a screenshot or describe what changed so I can verify without running the dev server
- If you encounter an unexpected design or product decision in HANDOFF.md, point it out and ask before working around it

## Open questions / things to flag

These aren't decided yet — surface them when you hit them, don't decide unilaterally:

- Domain name (placeholder used in HANDOFF)
- Real "now" line content (top-right hero anchor)
- Real email address for `mailto:` links
- Whether to add Plausible analytics (decision pending)
- Project case study pages (post-v1)