# Aino.agency — ASCII Animation Deep Dive

Technical analysis of https://aino.agency/ for design inspiration.

## Architecture Overview

Aino renders ASCII art as a **single text node** in a `position: fixed` div covering the full viewport. No canvas for the text — just a `<div class="grid mono">` with `white-space: pre`. The entire viewport is a monospace character grid.

**Stack:** Custom vanilla JS (no React/framework), Vite-bundled, ~21KB main + ~86KB lazy-loaded renderer. Deployed on Vercel.

**Grid system:** Viewport-responsive, calculated from font metrics:
- `--cols: 146` (characters per row)
- `--rows: 46` (total rows)
- `--ch: 8.219px` (character width)
- `--line: 16.438px` (line height)
- `--font-size: 12.799px`
- Column strips: `--strip-1` through `--strip-8` for layout

## The Character Ramp (23 characters)

```
"NO0A869452I3?!<>=+/:-· "
```

Ordered darkest → lightest. Maps directly to pixel brightness:

| Index | Char | Density |
|-------|------|---------|
| 0 | N | Darkest (most ink) |
| 1 | O | |
| 2 | 0 | |
| 3 | A | |
| 4 | 8 | |
| 5 | 6 | |
| 6 | 9 | |
| 7 | 4 | |
| 8 | 5 | |
| 9 | 2 | |
| 10 | I | |
| 11 | 3 | |
| 12 | ? | |
| 13 | ! | |
| 14 | < | |
| 15 | > | |
| 16 | = | |
| 17 | + | |
| 18 | / | |
| 19 | : | |
| 20 | - | |
| 21 | · | |
| 22 | (space) | Lightest (empty) |

The ramp spells the studio name when reading the dense end: **N-O-0-A-I** → "AINO" backwards. This is intentional branding embedded in the rendering system.

**Brightness function:** `B = (brightness) => RAMP[Math.ceil(22 * brightness / 255)]`

## Image-to-ASCII Pipeline

1. **Canvas downscale:** Source image drawn to an offscreen canvas at grid resolution (cols × rows pixels)
2. **getImageData:** Read RGBA pixel data at downscaled resolution
3. **Color processing:** RGB → brightness via `G = 0.21*R + 0.72*G + 0.07*B` (luminance formula)
4. **Dark mode inversion:** If dark appearance, RGB values are inverted (255 - value)
5. **Character mapping:** Brightness (0-255) → ramp index (0-22) → character
6. **Text assembly:** Characters joined into single string with `\n` line breaks
7. **DOM update:** `textContent` set on the grid div (using `&nbsp;` for spaces)

## Animation System

### Fade-in / Dissolve
Characters interpolate through the ramp over time:

```js
// Easing functions available:
I = e => e*e                    // easeIn quadratic
F = e => e*(2-e)                // easeOut quadratic (default)
j = e => e<.5 ? 2*e*e : (4-2*e)*e-1  // easeInOut quadratic
H = e => ...                    // easeInOut cubic
U = e => e*e*e*e*e              // easeIn quintic
V = e => 1+--e*e*e*e*e          // easeOut quintic
q = (a,b,t) => a*(1-t) + b*t   // lerp
```

The dissolve effect works by interpolating each character's ramp position toward space:
- `progress = easing(elapsed / duration)`
- Per character: `newIndex = lerp(23, currentIndex, progress)`
- Characters at different rows dissolve at different rates (staggered by row position)

### Hoverchar (Mouse Interaction)
Interactive elements get `data-active="true"` + `data-dy`, `data-dx`, `data-duration` attributes:
- Mouse position relative to element calculated
- Characters near cursor shift in the ramp (brighten or darken)
- The `dy`/`dx` values control the direction and magnitude of the shift

### Text Scramble / Reveal
Elements with `data-textreveal="scramble"` get a per-character decode animation:
- Characters start as random ramp characters
- Progressively reveal to their target characters
- Triggered by IntersectionObserver (threshold 0.3, once)
- Configurable speed and delay

### WebGL Substrate
Background fractal shader (separate from ASCII) with:
- Custom vertex/fragment shaders
- Grain overlay parameter
- Dark/light color theming
- Mouse trail interaction via 2D canvas overlay (physics-based particles with age, velocity, radius)

## Three Rendering Modes

Aino supports switching between modes (stored in localStorage):
1. **Default (image):** Photos displayed normally with ASCII overlay on hover
2. **Text mode:** Everything rendered as ASCII art
3. **Pixel mode:** Pixelated version of images

## The Full Animation Sequence (Home Page)

From the screenshots, the sequence is:

1. **Load state:** Dot pattern (hourglass shape) + fully scrambled nav text + "CLICK" prompt
2. **Hero resolve:** Dense ASCII art of studio imagery fades in through the ramp (characters climb from `·` → `N`)
3. **Scroll transition:** ASCII art dissolves as user scrolls — characters descend the ramp back toward `·` and `space`
4. **Content reveal:** Clean project photography appears beneath the dissolving ASCII layer
5. **Hover interaction:** Moving cursor over ASCII elements causes local ramp shifts (brightening/darkening nearby characters)

## Key Design Decisions

- **The ramp IS the brand.** "NOAI" embedded in the character order is a signature move.
- **Single text node.** No per-character DOM elements. Performance is O(1) for DOM updates — just replace the whole string.
- **Fixed-position grid.** ASCII layer sits above everything as a viewport-covering overlay. Content scrolls beneath it.
- **Monospace font is custom.** Self-hosted "mono" font — ensures exact character width calculations.
- **Everything is characters.** No SVG, no images in the grid. Pure text rendering.
- **Server-rendered initial state.** The ASCII art is in the HTML — no flash of empty content.
