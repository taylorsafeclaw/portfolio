# TODOS — v1 minimal ship

Source of truth for remaining work. Defer to `HANDOFF.md` for design intent, tokens, fonts, and voice.

Each phase ends with `pnpm typecheck && pnpm lint && pnpm build` clean.

---

## Phase 1 — Selected Work section (3–4 hr)

- [ ] `components/work/SelectedWork.tsx` — section header + mono table per HANDOFF spec
- [ ] `components/work/ProjectRow.tsx` — density char + title + description + year
- [ ] Section header: `selected work` in Monaspace Xenon, 13px, lowercase, letter-spacing 0.04em
- [ ] Hairline dividers between rows (`--border`)
- [ ] Hover state: `--bg-elev-1` background, density char shifts up one step
- [ ] Anchor `#selected-work` for hero CTA link
- [ ] Responsive: stack gracefully on mobile
- [ ] `prefers-reduced-motion`: hover transitions still work (they're CSS, not animation)
- [ ] Real project content (confirm with Taylor — Poppin + Stanford Health + current build?)

## Phase 2 — Footer + 404 (1–2 hr)

- [ ] Polish footer to match HANDOFF spec exactly (11px, `--fg-quiet`, `·` separators in `--fg-quietest`)
- [ ] `app/not-found.tsx` — centered, `404 — this page didn't ship` + back link
- [ ] Verify footer wraps gracefully on mobile

## Phase 3 — Mobile pass (2–3 hr)

- [ ] Wordmark scales correctly at all breakpoints (9px → 14px → 18px → 22–26px)
- [ ] Bio max-width: 90vw on mobile, 58ch on desktop
- [ ] CTAs stack vertically on mobile with 16px gap
- [ ] Selected Work table readable on small screens
- [ ] AsciiField churn rate appropriate for mobile (battery preservation)
- [ ] Test on iPhone SE viewport (375px)

## Phase 4 — Performance pass (3–4 hr)

- [ ] Investigate bundle composition (171KB gz baseline — what's heavy?)
- [ ] Paper Shaders `StaticMeshGradient` — benchmark on mobile, fallback to WebP if needed
- [ ] `motion` — verify tree-shaking, consider dynamic import if large
- [ ] Font preload: `<link rel="preload">` for Neon Regular/Medium + Xenon Regular
- [ ] Lighthouse mobile: target 100/100/100/100
- [ ] LCP < 1.0s, CLS = 0, INP < 200ms, TBT < 100ms
- [ ] Total JS shipped < 100KB gz

## Phase 5 — Deploy (1–2 hr)

- [ ] Vercel project linked
- [ ] Domain attached + DNS verified
- [ ] Env vars (if any) set on production
- [ ] OG image: 1200×630 PNG of TAYLOR wordmark
- [ ] `metadata.openGraph` + `metadata.twitter` in `app/layout.tsx`
- [ ] `robots.txt` + `sitemap.xml` (Next 16 metadata file conventions)
- [ ] Verify prod Lighthouse within 2 points of local

---

## Decisions still open

- [ ] Domain confirmed (`taylorallen.dev`)
- [ ] Real project content for Selected Work
- [ ] Email address for mailto
- [ ] Plausible analytics (yes/no)

---

## Out of scope for v1

- Spotify NowPlaying (any variant)
- Bio footnotes
- AsciiCanvas primitive refactor
- Sub-pages (`/now`, `/writing`, etc.)
- Touch halo on wordmark
- Tab title oscillation
- Beat-synced anything
- Cmd+K palette, Konami code
- Print stylesheet
- Performance regression CI

---

## Design skills available

Use `frontend-design`, `design-taste-frontend`, `minimalist-ui`, and `full-output-enforcement` skills when implementing visual work. Reference designs in `docs/design-references/` for inspiration.

## Quick reference

| Need to know   | Where                                           |
| -------------- | ----------------------------------------------- |
| Design intent  | `HANDOFF.md`                                    |
| v1 plan        | `plan.md`                                       |
| Tokens / fonts | `HANDOFF.md` + `app/globals.css`                |
| Perf baseline  | `docs/perf-baseline.md`                         |
| Design refs    | `docs/design-references/`                       |
| Design skills  | `.agents/skills/` (taste-skill suite)           |
