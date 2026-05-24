# Performance baseline — pre-Phase 1

Captured **2026-04-26** on branch `feat/v1-arc` (off `6c3695a` + uncommitted Phase 0 setup).
Every later phase compares against these numbers.

## Toolchain

- Node: v22.22.0
- pnpm: 10.30.2
- Next.js: 16.2.4 (Turbopack production build)
- React: 19.2.4

## Pipeline status

| Check          | Result |
| -------------- | ------ |
| `pnpm typecheck` | clean |
| `pnpm lint`      | clean |
| `pnpm build`     | clean (4 static pages prerendered) |

## Bundle — `pnpm build` output

Next 16 / Turbopack does not emit the legacy First Load JS table, so sizes are computed directly from `.next/static/chunks/`. Per `.next/build-manifest.json`, the root chunks loaded on `/` are:

| Chunk                        | Raw     | Gzipped  | Role     |
| ---------------------------- | ------- | -------- | -------- |
| `0v3lyuj75aq50.js`           | 222 KB  | **71.0 KB** | rootMain |
| `12cqinqs67z4b.js`           | 195 KB  | **50.3 KB** | rootMain |
| `0mi9ffb0i7c69.js`           |  17 KB  |  **6.1 KB** | rootMain |
| `turbopack-0ukl_j42rak_i.js` |  10 KB  |  **4.2 KB** | rootMain |
| `03~yq9q893hmn.js`           | 110 KB  | **39.5 KB** | polyfill |
| **First Load JS (`/`)**      | **554 KB** | **~171 KB gz** | |

Total chunks across all routes: **231 KB gz** across 8 files.

### Headline

The plan's 100 KB gz ceiling is already breached at baseline. Likely sources (verify in Phase 1):

- `@paper-design/shaders-react` (substrate StaticMeshGradient)
- `motion` (motion/react animation library)
- `radix-ui` (will be needed in Phase 2 for Tooltip)

Mitigation already planned — Phase 5 substrate WebP fallback for mobile. Desktop ceiling may need to be revised, or the shader has to come out of the critical path. Flag for Phase 1 perf gate review.

## Lighthouse / Web Vitals — TODO (manual)

Cannot run Lighthouse from the agent shell. Run locally and append:

```sh
pnpm dev
# in another terminal, with Chrome installed:
pnpm dlx lighthouse http://localhost:3000 \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=html --output-path=docs/lh-baseline-desktop.html

pnpm dlx lighthouse http://localhost:3000 \
  --form-factor=mobile --throttling-method=simulate \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=html --output-path=docs/lh-baseline-mobile.html
```

Then fill in:

| Metric              | Desktop | Mobile |
| ------------------- | ------- | ------ |
| Performance         | _TBD_   | _TBD_  |
| Accessibility       | _TBD_   | _TBD_  |
| Best Practices      | _TBD_   | _TBD_  |
| SEO                 | _TBD_   | _TBD_  |
| LCP                 | _TBD_   | _TBD_  |
| CLS                 | _TBD_   | _TBD_  |
| INP                 | _TBD_   | _TBD_  |
| TBT                 | _TBD_   | _TBD_  |

## Wordmark animation frame rate — TODO (manual)

Open `/`, DevTools → Performance → record ~5s of steady-state hero (no interaction), then ~5s with cursor moving over the wordmark. Fill in:

| Scenario                     | Desktop (Chrome) | iPhone SE (real or emulated) |
| ---------------------------- | ---------------- | ---------------------------- |
| Steady-state wave pulse      | _TBD_ fps        | _TBD_ fps                    |
| Cursor halo active           | _TBD_ fps        | _TBD_ fps                    |
| `document.hidden` rAF paused | _TBD_ (Y/N)      | _TBD_ (Y/N)                  |

## Hero animation regression baseline

Screen recording of the current `/` hero (10s loop) → `docs/baseline-hero.mov`. **TODO: capture before starting Phase 1**, since the refactor must be pixel-identical against this.

```sh
# macOS — record main display, 10 seconds, then trim
screencapture -V 10 -v docs/baseline-hero.mov
```

## What this baseline means for later phases

- **Phase 1 perf gate (≤ +1KB gz)** — measured against the rootMain + polyfill total above. Phase 1 is a refactor; net delta should round to zero.
- **Phase 6 hard ceiling (< 100KB gz JS, < 200KB initial transfer)** — currently failing on JS bundle. Either the substrate shader gets a hard fallback strategy earlier than Phase 5, or the ceiling is renegotiated explicitly. Don't paper over it.
