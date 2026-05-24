# TODOS — interactive resume

Source of truth for remaining work. Full design spec lives in `docs/superpowers/specs/2026-05-24-interactive-resume-design.md`. Implementation plan with code in `docs/superpowers/plans/2026-05-24-interactive-resume.md`.

Each phase ends with `pnpm typecheck && pnpm lint && pnpm build` clean.

---

## Phase 1 — Shared primitives (DONE)

- [x] Task 1: `lib/ascii/density.ts` — breathing, sparkle, erosion math
- [x] Task 2: `lib/hooks/useInView.ts` — IntersectionObserver hook for scroll-triggered effects
- [x] Task 3: `components/shared/HeaderDecode.tsx` — viewport-triggered scramble decode for section headers
- [x] Task 4: `components/story/TextGenerate.tsx` — word-by-word reveal with density ramp flash
- [x] Task 5: `components/shared/BorderBeam.tsx` — density char walking section dividers

---

## Phase 2 — Content sections (pending)

- [ ] Task 6: Story section (`components/story/Story.tsx`) — narrative "who I am", text generate, header decode
- [ ] Task 7: Conviction section (`components/conviction/Conviction.tsx`) — 3 scroll-paced belief statements in Instrument Serif italic
- [ ] Task 8: WorkCard + SelectedWork rewrite — focus cards with spotlight, moving border, focus dimming
  - Create `components/work/WorkCard.tsx`
  - Rewrite `components/work/SelectedWork.tsx`
  - Update `lib/projects.ts` with real Odisai / Stanford / Poppin data
  - Delete `components/work/ProjectRow.tsx`
- [ ] Task 9: Footer rewrite (`components/footer/Footer.tsx`) — magnetic CTA, "Let's build something.", text generate tagline
  - Create `lib/hooks/useMagnetic.ts`

---

## Phase 3 — Site-wide ASCII field (pending)

- [ ] Task 10: AsciiGrid site-wide refactor
  - Move AsciiGrid from hero-scoped to `app/layout.tsx` (fixed, full-viewport)
  - Add Instrument Serif font to layout (`next/font/google` or self-hosted)
  - Tune breathing waves and sparkles (reduce ambient to ~10%)
  - Remove `<AsciiGrid />` from `components/hero/Hero.tsx`
- [ ] Task 11: Density erosion integration
  - Create `components/shared/SectionWrapper.tsx` — registers erosion zones
  - Wrap Story, SelectedWork, Conviction, Footer with SectionWrapper
  - Connect erosion zones to AsciiGrid draw loop

---

## Phase 4 — Polish (pending)

- [ ] Task 12: Mobile and responsive pass
  - AsciiGrid: larger cell size, fewer sparkles, simpler erosion on mobile
  - WorkCard: touch behavior (tap-to-focus, no spotlight, no moving border on touch)
  - Verify all sections at 375px viewport
- [ ] Task 13: Reduced motion audit
  - Verify all 12 effects skip or simplify when `prefers-reduced-motion: reduce`
  - Test with macOS Reduce Motion enabled
- [ ] Task 14: Final cleanup
  - Full build check: `pnpm typecheck && pnpm lint && pnpm build`
  - Update `CLAUDE.md` to reference new spec

---

## Decisions still open

- [ ] Domain confirmed (`taylorallen.dev` assumed)
- [ ] Final Story section copy
- [ ] Final Conviction section copy (2 or 3 statements?)
- [ ] Real email address for mailto
- [ ] OG image design
- [ ] Plausible analytics (yes/no)

---

## Out of scope for v1

- Sub-pages (`/about`, `/writing`, `/uses`, `/now`)
- Real project screenshots or images
- Dither shader, ASCII art component
- Blog, writing section
- Light mode, accent colors, non-Monaspace fonts
- Performance regression CI
