# Aino.agency — Live Exploration: Micro-interaction Catalog

Companion to `aino-analysis.md`. Findings from driving the live site (June 2026,
1440×900 + 390×844) via browser automation. Informs
`docs/superpowers/specs/2026-06-11-living-ascii-field-design.md` §6b.

## Corrected/extracted architecture facts

- The field is **one `<div class="grid mono">` text node** (~10k chars), `position:
  fixed`, rewritten per RAF tick from a cell buffer (`buffer.fill(" ")` → write layers →
  `textContent` swap). Canvas is used only as a sampler for images/video.
- Grid vars at 1440×900: `--cols: 178`, `--rows: 55`, `--ch: 8.09px`, `--line: 16.18px`,
  font 12.58px, letter-spacing 0.54px. Mobile: 48×51.
- Primary ramp (23, dense→empty): `NO0A869452I3?!<>=+/:-· `
- Extended ramp (video textures + scramble alphabet) salts in the Scandinavian brand:
  `$MBNQØW@&R8GD6S9ÖOH#ÉE5UK0ÄÅA2XP34ZC%VIF17YTJL…` (Ø Ö Ä Å É).
- Video → ASCII via `requestVideoFrameCallback`; luminance `L = .21r+.72g+.07b`,
  `char = ramp[ceil(22·L/255)]`.
- State in `localStorage.site`: `mode: image|text|pixel`, `appearance: dark|light`,
  `workView: grid|list`, `theme: fantasy|c64|ansi|nes|db16` (pixel-mode palettes;
  "fantasy" is PICO-8).
- Interaction attributes: `data-active`, `data-dx/dy/duration` (scramble radius/length),
  `data-textreveal="scramble"` + `data-delay` (IO threshold 0.3, once),
  `data-preventclick`, `data-dialog`.

## Intro sequence (home, first visit)

1. t≈0: blank paper; an `=` progress bar draws across grid row 1 (1000ms, eased).
2. t≈300–800ms: nav labels materialize *as grid cells* at fixed columns, cross-fading
   from the bar; a trickle of `·` falls down the center column.
3. t≈800ms+: procedural **hourglass**: per-row cosine spans (3s/4s/8s superposed
   periods) open around center; ramp index from `cos(phase)` → concentric density bands
   ripple through the shape; 3000ms global fade-in; breathes endlessly until click.
4. Cursor X (doubly-smoothed: 200ms lag + heavy `0.01` lerp) offsets the wave phase —
   the bands lean toward and swirl around the cursor.
5. The word `CLICK` is written into the grid at the cursor's cell (mobile: "Tap to
   continue", bottom row).
6. On mousedown: field **collapses with physics** (gravity 2, damping .9, spread .4) →
   ~200ms → surviving cells morph into the AINO logo (sampled from `/aino.svg`) →
   1400ms → showreel plays as live ASCII video → on end/2nd click, content
   scramble-reveals. Return visits (`window._visited`) skip the choreography.

## Micro-interaction catalog (24)

1. `=` loading bar → morphs into nav cells (1000ms).
2. Procedural hourglass ambient field (superposed cosine periods).
3. Cursor warps the field's wave phase (two smoothing constants).
4. `CLICK` label rendered at cursor cell inside the grid.
5. Click → gravity collapse of all visible cells.
6. Particle → logo morph (cells tween to svg-sampled cells).
7. Full-grid ASCII showreel video.
8. **Signature hover scramble**: `caretPositionFromPoint` finds the exact glyph under
   the cursor; ±`data-dx` cells (default 1) scramble — each char travels the extended
   ramp out-and-back on an easeOutQuint triangle wave over `data-duration` (default
   1000ms); lowercase alphabet for lowercase chars (case rhythm preserved); ~40fps
   setTimeout loop. Verified live: "Work" → "Kork" → "Åäek" → "8xäk" → "Work".
9. Width-lock on scrambling buttons (prevents proportional-glyph layout shift).
10. `data-textreveal="scramble"`: on 30% intersection (once), chars blank → per-char
    scramble-resolve, ~2ms/char stagger, 400ms/char, opacity in at +50ms.
11. **ASCII→image resolve**: every img/video ships a pre-rendered ASCII twin; on load a
    "fadein" filter walks each char space→final along the 23-ramp over 1500ms with 50ms
    per-row sweep; real image fades over it. Runs on *every* image, every route change.
12. IMG mode switch (Image/Text/Pixel) — teardown/rebuild cascades 50ms per element.
13. THEME picker re-quantizes pixel-mode imagery live (PICO-8/C64/ANSI/NES/DB16).
14. Dark/light MOOD toggle; pre-paint inline script, no flash.
15. Settings/Contact native `<dialog>`; content scramble-reveals; **`::backdrop` is a
    4×4px repeating-conic-gradient checkerboard dither** — halftone instead of dim.
16. Work GRID|LIST toggle, persisted.
17. Work-table row click: row `.active`, list `.out` cascade, 400ms, route swap.
18. SPA page transitions: arriving page re-materializes (images ramp-resolve, text
    scrambles in) — navigation itself is the identity.
19. Work card hover: caption labels scramble under cursor.
20. /play arcade (TEXTRIS/SNEKST/PAKKU); dark mode there has the site's only accent
    (`--ascii-color: #3fa`).
21. Live footer clock: `GBG/SAL · weekday · HH:MM:SS`.
22. Mobile: 48×51 grid; `touchmove` drives scramble; full-screen menu in display sans.
23. 404: "404 — Page not found" in two grid columns, nothing else.
24. No custom cursor anywhere — default/pointer/text only. Restraint.

## Non-ASCII beauty

- All spacing in `--ch`/`--line` multiples — DOM text and field share one lattice.
- Two-voice typography: small mono caps vs. huge ABC grotesque; nothing between.
- Work LIST view: numbered archive 001–038, linked rows dark / unlinked muted.
- Warm paper `#f3f3ee`, desaturated photography, thin mono meta strips.

## What we adopted (see spec §6b) vs. parked

Adopted: char-precision hover scramble (monospace → `offsetX/charW`, no caret API);
ramp-walk as universal enter (unify DensityResolve/TextGenerate/HeaderDecode);
live footer clock; "definitive end-state" intro principle; grid-lattice discipline.
Parked (post-v1): TEXT/PIXEL mode easter egg, cursor-cell labels, palette themes,
arcade, physics collapse.

Raw captures + engine source: `/tmp/aino-explore/` (61 screenshots, `main.js`,
`Dc28V7Bw.js`, `a.css`/`b.css`) — ephemeral, re-run the exploration if needed.
