# Plan — taylorallen.dev v1 (minimal ship)

> **May 2026 revision.** The previous plan expanded scope into Spotify integration, bio footnotes, AsciiCanvas refactoring, and ~25 hours of work. That direction is deprecated. This plan returns to the original HANDOFF.md vision: ship a minimal, polished single-page site.

`HANDOFF.md` is the canonical design spec. This plan covers what remains to ship v1.

---

## Thesis

The hero animation is the hard part — and it's done. What remains is finishing the page (Selected Work, footer, 404), fixing the bundle size problem (171KB gz vs. 100KB ceiling), polishing for mobile, and deploying. Design skills (taste-skill, minimalist-ui, design-taste-frontend) provide guardrails against generic output during implementation.

---

## What's built

- Hero section (wordmark animation, AsciiField, GridLayer, AmbientDrift, ScrambleLink, bio, CTAs)
- Basic footer (name · year · location · email)
- Design tokens, fonts, substrate
- Full HANDOFF.md design spec

## What ships in v1

1. **Selected Work section** — mono table with 2–4 real projects (per HANDOFF.md spec)
2. **Footer polish** — match HANDOFF spec exactly
3. **404 page** — `app/not-found.tsx` per HANDOFF spec
4. **Mobile pass** — responsive scaling, touch interactions
5. **Performance pass** — get bundle under 100KB gz (investigate Paper Shaders, motion, radix-ui sizes)
6. **Deploy** — Vercel, domain, OG image, metadata

## What's cut from v1

- ~~Spotify NowPlaying integration~~
- ~~Bio footnotes~~
- ~~AsciiCanvas primitive refactor~~
- ~~Album-to-ASCII conversion~~
- ~~Touch halo on wordmark~~
- ~~Tab title oscillation~~
- ~~Colophon footer with build credits~~

These can return in v1.1+ once the site is live and earning its place.

---

## Design skills in use

| Skill | Role |
|-------|------|
| `frontend-design` | Primary visual decision-making |
| `design-taste-frontend` | Anti-slop guardrails, ensures premium output |
| `minimalist-ui` | Editorial minimalism enforcement |
| `full-output-enforcement` | No placeholders, complete deliverables |

Reference designs in `docs/design-references/` (ollama, resend, cursor, linear, xai, warp) for spacing, density, and component pattern inspiration.

**Override rule:** HANDOFF.md > skills > defaults. Skills suggest; HANDOFF decides.

---

## Open decisions

- Domain: `taylorallen.dev` (confirm + purchase)
- Real project content for Selected Work table
- Email address for mailto links
- Plausible analytics (yes/no)
