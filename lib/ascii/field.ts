// lib/ascii/field.ts

/**
 * The living field engine (§2): every cell holds a target ramp position and
 * a current position eased toward it each frame. The intro, cursor trail,
 * ripples, erosion, and footer gravity are all modulations on the one
 * target — no separate intro engine, no mode seam.
 *
 * This module is DOM-free. AsciiGrid owns the canvas, atlas, and input
 * events and feeds the engine plain numbers.
 */

import { ATLAS_BACKSLASH, ATLAS_PIPE } from "@/lib/ascii/ramp";
import { smoothstep } from "@/lib/ascii/noise";
import { clamp } from "@/lib/ascii/density";

// ── Tuning constants (§2, §3, §4, §5) — starting values; expect a visual pass ──

// contextual easing time constants (§2)
export const TAU_AMBIENT = 220; // ms — slow ink settling
export const TAU_TRAIL_RISE = 80; // ms — immediate response to touch
export const TAU_TRAIL_DECAY = 350; // ms — wake dissipating
export const TAU_EROSION = 400; // ms — ink receding from content
export const TAUS = [TAU_AMBIENT, TAU_TRAIL_RISE, TAU_TRAIL_DECAY, TAU_EROSION] as const;
export const TAU_CLASS_AMBIENT = 0;
export const TAU_CLASS_RISE = 1;
export const TAU_CLASS_DECAY = 2;
export const TAU_CLASS_EROSION = 3;

// ambient field (§3)
export const FEATURE_SCALE = 0.3; // feature wavelength ≈ 30% of min(vw, vh)
export const DRIFT_PX_S = 8; // diagonal advection speed
export const MORPH_PERIOD_MS = 60_000; // time-as-third-phase morph
export const CONTRAST_LO = 0.42; // smoothstep edges — emptiness lives below
export const CONTRAST_HI = 0.85;
export const HERO_FLOOR = 0.55; // ambient scale while the hero holds the viewport (§6)

// cursor wake (§4)
export const TRAIL_SAMPLES = 24;
export const TRAIL_DECAY_MS = 280;
export const TRAIL_R_SLOW = 90; // px — slow cursor draws a fine line
export const TRAIL_R_FAST = 150; // px — fast sweep drags a broad wake
export const TRAIL_MAX_LIFT = 8; // ramp steps — stirring reaches the letters
export const TRAIL_GAIN = 1.5;

// ripples (§3b-B/C)
export const RIPPLE_SPEED = 0.35; // px/ms ring expansion
export const RIPPLE_SIGMA = 30; // px gaussian band half-width
export const PULSE_REACH = 0.4; // pulses dissipate by 40% of the viewport

// footer flood (§6)
export const GRAVITY_STEPS = 12;

// intro (§5) — the total envelope matches the wordmark (RESOLVE_DONE 4800)
export const INTRO_DORMANT_END = 250;
export const INTRO_BLOOM_END = 2600;
export const INTRO_PEAK_END = 3600;
export const INTRO_RECEDE_END = 5100;
export const INTRO_CREST = 6; // ramp steps above ambient at the front line
export const INTRO_OVERSHOOT = 1.5; // ambient multiplier behind the front
export const INTRO_JITTER_MS = 60; // per-cell arrival jitter
const INTRO_FRONT_REACH = 1.35; // front travels past the corner so the crest clears
const INTRO_FRONT_SIGMA = 0.08;
const INTRO_DORMANT_MASK = 0.08; // scattered specks at alpha ≈ 0.05
const INTRO_BREATH = 0.12; // one slow synchronized breath at peak

// flow strokes (§3b-A)
export const FLOW_MIN = 3;
export const FLOW_MAX = 9;
const FLOW_EPS = 0.35; // gradient magnitude below this keeps the ramp glyph
const FLOW_BUCKET_ATLAS = [2, ATLAS_BACKSLASH, ATLAS_PIPE, 4] as const; // - \ | /

/** Per-frame easing factor for a time constant τ: 1 − e^(−dt/τ) (§2). */
export function easeFactor(dtMs: number, tau: number): number {
  return 1 - Math.exp(-dtMs / tau);
}

/** The bloom front's ease: 1 − (1 − t)^1.8, clamped (§5). */
export function bloomEase(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 1.8);
}

export interface IntroState {
  mask: number;
  crest: number;
}

/**
 * The intro as a modulation on the one pipeline (§5): `mask` multiplies the
 * ambient target, `crest` adds the traveling ink front. After the intro the
 * envelope is identically (1, 0) — the handoff is seamless by construction.
 *
 * `distNorm` is the cell's pixel distance from viewport center, normalized
 * so the farthest corner is 1. Writes into `out` — zero allocation.
 */
export function introEnvelope(
  distNorm: number,
  jitterMs: number,
  elapsed: number,
  out: IntroState,
): IntroState {
  if (elapsed >= INTRO_RECEDE_END) {
    out.mask = 1;
    out.crest = 0;
    return out;
  }
  if (elapsed < INTRO_DORMANT_END) {
    out.mask = INTRO_DORMANT_MASK;
    out.crest = 0;
    return out;
  }
  if (elapsed < INTRO_BLOOM_END) {
    const t = (elapsed + jitterMs - INTRO_DORMANT_END) / (INTRO_BLOOM_END - INTRO_DORMANT_END);
    const front = bloomEase(t) * INTRO_FRONT_REACH;
    const ignT = Math.min(1, (elapsed - INTRO_DORMANT_END) / 300);
    const ign = ignT * ignT; // soft ignition — no value jump at the dormant boundary
    const sdf = distNorm - front;
    const settled = smoothstep(0, 0.25, Math.max(0, -sdf));
    out.mask = INTRO_DORMANT_MASK + (INTRO_OVERSHOOT - INTRO_DORMANT_MASK) * settled * ign;
    out.crest = INTRO_CREST * Math.exp(-(sdf * sdf) / (2 * INTRO_FRONT_SIGMA * INTRO_FRONT_SIGMA)) * ign;
    return out;
  }
  if (elapsed < INTRO_PEAK_END) {
    const t = (elapsed - INTRO_BLOOM_END) / (INTRO_PEAK_END - INTRO_BLOOM_END);
    out.mask = INTRO_OVERSHOOT + INTRO_BREATH * Math.sin(Math.PI * t);
    out.crest = 0;
    return out;
  }
  // recede (§5): edges ease down first, center last — ink drains into the name
  const phaseT = (elapsed - INTRO_PEAK_END) / (INTRO_RECEDE_END - INTRO_PEAK_END);
  const stagger = (1 - Math.min(1, distNorm)) * 0.4;
  const cellT = clamp((phaseT - stagger) / Math.max(0.01, 1 - stagger), 0, 1);
  const s = cellT * cellT * (3 - 2 * cellT);
  out.mask = INTRO_OVERSHOOT + (1 - INTRO_OVERSHOOT) * s;
  out.crest = 0;
  return out;
}

/**
 * Flow-aligned stroke substitution (§3b-A): the atlas index of the
 * directional glyph for a local density gradient, or −1 to keep the ramp
 * glyph. Strokes run along the contour — perpendicular to the gradient.
 * Screen coordinates (y down): gradient (1,1) → "/" stroke.
 */
export function flowAtlasIndex(gx: number, gy: number): number {
  if (gx * gx + gy * gy < FLOW_EPS * FLOW_EPS) return -1;
  let a = Math.atan2(gy, gx) + Math.PI / 2;
  a %= Math.PI;
  if (a < 0) a += Math.PI;
  return FLOW_BUCKET_ATLAS[Math.round(a / (Math.PI / 4)) % 4];
}
