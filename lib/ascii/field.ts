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

import { AMBIENT_CEIL, ATLAS_BACKSLASH, ATLAS_PIPE, FIELD_RAMP_LEN } from "@/lib/ascii/ramp";
import { buildPerm, smoothstep, warpedFbm } from "@/lib/ascii/noise";
import { clamp, erosionAlpha, type ErosionZone } from "@/lib/ascii/density";
import type { Ripple } from "@/lib/ascii/pulse-store";

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
// smoothstep low edge — spec §3 writes 0.42, but the warped-fbm distribution
// needs ~0.47 to leave ~half the field empty (the spec's actual stated goal,
// pinned by the "roughly half rests at space" test). Visual-tuned, not literal.
export const CONTRAST_LO = 0.47;
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

// footer flood (§6) — uncapped climb to the dense end so R 0 L Y A T flood the
// lower viewport before the final void (spec §6); 28 reaches the name letters.
export const GRAVITY_STEPS = 28;

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

export interface FieldFrameInput {
  now: number; // performance.now()
  introElapsed: number; // ms since mount; Infinity disables the intro
  heroDissolve: number; // scroll-store snapshot
  footerGravity: number;
  zones: readonly ErosionZone[];
  ripples: readonly Ripple[];
  scrollDrift: number; // px — scroll counter-advection offset (§3b-C)
}

export class FieldEngine {
  readonly cols: number;
  readonly rows: number;
  readonly total: number;
  readonly target: Float32Array;
  readonly current: Float32Array;

  private readonly tauClass: Uint8Array;
  private readonly jitter: Float32Array;
  private readonly distNorm: Float32Array;
  private readonly perm: Uint8Array;
  private readonly kScratch = new Float32Array(TAUS.length);
  private readonly introState: IntroState = { mask: 1, crest: 0 };

  private readonly charW: number;
  private readonly charH: number;
  private readonly vw: number;
  private readonly vh: number;
  private readonly octaves: number;
  private readonly noiseScale: number;

  // cursor trail ring buffer (§4) — all preallocated, zero per-frame allocation
  private readonly trailX = new Float32Array(TRAIL_SAMPLES);
  private readonly trailY = new Float32Array(TRAIL_SAMPLES);
  private readonly trailT = new Float32Array(TRAIL_SAMPLES);
  private readonly trailR = new Float32Array(TRAIL_SAMPLES);
  private readonly trailW = new Float32Array(TRAIL_SAMPLES); // scratch: per-pass age weights
  private trailHead = 0;

  constructor(
    cols: number,
    rows: number,
    charW: number,
    charH: number,
    vw: number,
    vh: number,
    octaves: number,
    seed = 1337,
  ) {
    this.cols = cols;
    this.rows = rows;
    this.total = cols * rows;
    this.charW = charW;
    this.charH = charH;
    this.vw = vw;
    this.vh = vh;
    this.octaves = octaves; // 3 = desktop (warp on, see noise.ts); 2 = light
    this.noiseScale = 1 / Math.max(1, FEATURE_SCALE * Math.min(vw, vh));
    this.perm = buildPerm(seed);
    this.target = new Float32Array(this.total);
    this.current = new Float32Array(this.total);
    this.tauClass = new Uint8Array(this.total);
    this.jitter = new Float32Array(this.total);
    this.distNorm = new Float32Array(this.total);

    const cx = vw / 2;
    const cy = vh / 2;
    const corner = Math.max(1, Math.sqrt(cx * cx + cy * cy));
    for (let i = 0; i < this.total; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const px = col * charW + charW / 2 - cx;
      const py = row * charH + charH / 2 - cy;
      this.distNorm[i] = Math.sqrt(px * px + py * py) / corner;
      const h = ((col * 7919 + row * 104729) % 1000) / 1000;
      this.jitter[i] = (h - 0.5) * 2 * INTRO_JITTER_MS;
    }
    this.trailT.fill(-1e9);
  }

  /** Push a pointer sample into the trail ring buffer (§4). Radius scales with speed. */
  addTrailSample(x: number, y: number, now: number, speedPxMs: number): void {
    const i = this.trailHead;
    this.trailX[i] = x;
    this.trailY[i] = y;
    this.trailT[i] = now;
    this.trailR[i] = TRAIL_R_SLOW + Math.min(1, speedPxMs / 1.5) * (TRAIL_R_FAST - TRAIL_R_SLOW);
    this.trailHead = (i + 1) % TRAIL_SAMPLES;
  }

  /** The §2 pipeline. Runs every 2nd frame desktop / 3rd mobile (§8). */
  recomputeTargets(input: FieldFrameInput): void {
    const { now, introElapsed, heroDissolve, footerGravity, zones, ripples, scrollDrift } = input;
    const { cols, rows, charW, charH, vw, vh, octaves, noiseScale, perm } = this;

    const drift = (now / 1000) * DRIFT_PX_S * 0.7071; // diagonal advection (§3)
    const z = now / MORPH_PERIOD_MS;
    const heroScale = HERO_FLOOR + (1 - HERO_FLOOR) * heroDissolve; // §6
    const introActive = introElapsed < INTRO_RECEDE_END;
    const voidRaw = footerGravity > 0.8 ? Math.max(0, 1 - (footerGravity - 0.8) / 0.2) : 1;
    const voidScale = voidRaw < 1e-12 ? 0 : voidRaw; // snap float dust so the final void reaches exactly 0 (§6)
    const hasZones = zones.length > 0;
    const bandFade =
      heroDissolve > 0.3 && heroDissolve < 1
        ? clamp(heroDissolve < 0.5 ? (heroDissolve - 0.3) / 0.2 : 1 - (heroDissolve - 0.8) / 0.2, 0, 1)
        : 0;

    // per-sample trail weights + bounding box for this pass
    let trailMinX = Infinity;
    let trailMaxX = -Infinity;
    let trailMinY = Infinity;
    let trailMaxY = -Infinity;
    for (let s = 0; s < TRAIL_SAMPLES; s++) {
      const age = now - this.trailT[s];
      const w = age >= 0 && age < 1200 ? Math.exp(-age / TRAIL_DECAY_MS) : 0;
      this.trailW[s] = w;
      if (w > 0.01) {
        const r = this.trailR[s];
        if (this.trailX[s] - r < trailMinX) trailMinX = this.trailX[s] - r;
        if (this.trailX[s] + r > trailMaxX) trailMaxX = this.trailX[s] + r;
        if (this.trailY[s] - r < trailMinY) trailMinY = this.trailY[s] - r;
        if (this.trailY[s] + r > trailMaxY) trailMaxY = this.trailY[s] + r;
      }
    }

    const rippleCount = ripples.length;

    for (let row = 0; row < rows; row++) {
      const y = row * charH + charH / 2;
      const viewportNorm = y / vh;
      // section divider band (§6) — kept from the old field, as a ramp boost
      let rowBand = 0;
      if (bandFade > 0) {
        const distFromBand = Math.abs(viewportNorm - 0.5);
        if (distFromBand < 0.08) rowBand = (1 - distFromBand / 0.08) * bandFade;
      }
      const rowGravity = footerGravity > 0 ? footerGravity * viewportNorm * GRAVITY_STEPS : 0;

      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const x = col * charW + charW / 2;

        // §3 ambient: pixel-space domain-warped fbm, advected + morphing,
        // contrast-curved so ~half the field rests at or near space
        const n = warpedFbm(perm, (x + drift) * noiseScale, (y + drift + scrollDrift) * noiseScale, z, octaves);
        let ambient = smoothstep(CONTRAST_LO, CONTRAST_HI, n) * AMBIENT_CEIL * heroScale;

        // erosionAlpha only reads the array; cast away readonly for its mutable param
        const ero = hasZones ? erosionAlpha(x, y, vw, vh, zones as ErosionZone[]) : 1;
        ambient *= ero;

        let crest = 0;
        if (introActive) {
          const intro = introEnvelope(this.distNorm[i], this.jitter[i], introElapsed, this.introState);
          ambient *= intro.mask;
          crest = intro.crest;
        }

        // §4 cursor wake (bbox-bounded)
        let trail = 0;
        if (x >= trailMinX && x <= trailMaxX && y >= trailMinY && y <= trailMaxY) {
          for (let s = 0; s < TRAIL_SAMPLES; s++) {
            const w = this.trailW[s];
            if (w < 0.01) continue;
            const dx = x - this.trailX[s];
            const dy = y - this.trailY[s];
            const r = this.trailR[s];
            const d2 = dx * dx + dy * dy;
            if (d2 > r * r) continue;
            trail += Math.exp((-d2 / (r * r)) * 3) * w;
          }
          if (trail > 0) trail = Math.min(TRAIL_MAX_LIFT, trail * TRAIL_GAIN);
        }

        // §3b ripples — wordmark pulses + click rings
        let rippleLift = 0;
        for (let p = 0; p < rippleCount; p++) {
          const rp = ripples[p];
          const age = now - rp.start;
          if (age < 0 || age > rp.life) continue;
          const radius = age * RIPPLE_SPEED;
          const fade =
            rp.kind === "pulse"
              ? Math.max(0, 1 - radius / (PULSE_REACH * Math.min(vw, vh)))
              : Math.max(0, 1 - age / rp.life);
          if (fade <= 0) continue;
          const dx = x - rp.x;
          const dy = y - rp.y;
          const dr = Math.sqrt(dx * dx + dy * dy) - radius;
          if (dr * dr > 9 * RIPPLE_SIGMA * RIPPLE_SIGMA) continue;
          rippleLift += rp.amp * Math.exp(-(dr * dr) / (2 * RIPPLE_SIGMA * RIPPLE_SIGMA)) * fade;
        }

        const band = rowBand > 0 ? rowBand * (1 - Math.abs(col / Math.max(1, cols - 1) - 0.5) * 2) * 5 : 0;

        const t = (ambient + crest + trail + rippleLift + band + rowGravity) * voidScale;
        this.target[i] = clamp(t, 0, FIELD_RAMP_LEN - 1);

        // contextual τ (§2): touch responds fastest, erosion recedes slowest
        this.tauClass[i] =
          trail > 0.3
            ? this.target[i] > this.current[i]
              ? TAU_CLASS_RISE
              : TAU_CLASS_DECAY
            : ero < 0.98
              ? TAU_CLASS_EROSION
              : TAU_CLASS_AMBIENT;
      }
    }
  }

  /** Per-frame easing pass — one multiply-add per cell (§2). */
  ease(dtMs: number): void {
    const ks = this.kScratch;
    for (let c = 0; c < TAUS.length; c++) ks[c] = easeFactor(dtMs, TAUS[c]);
    const { target, current, tauClass, total } = this;
    for (let i = 0; i < total; i++) {
      current[i] += (target[i] - current[i]) * ks[tauClass[i]];
    }
  }

  /** Snap current to target — the reduced-motion static frame (§10.5). */
  settle(): void {
    this.current.set(this.target);
  }

  /** Flow-stroke atlas index from target-grid finite differences (§3b-A). */
  flowIndexAt(i: number): number {
    const col = i % this.cols;
    const row = (i / this.cols) | 0;
    const t = this.target;
    const gx = (col < this.cols - 1 ? t[i + 1] : t[i]) - (col > 0 ? t[i - 1] : t[i]);
    const gy = (row < this.rows - 1 ? t[i + this.cols] : t[i]) - (row > 0 ? t[i - this.cols] : t[i]);
    return flowAtlasIndex(gx, gy);
  }
}
