// lib/ascii/ramp.ts

/**
 * The field ramp — 25 steps, light → dense (§1). Read backwards from the
 * dense end it spells T-A-Y-L-0-R. Index 0 is a true space: characters can
 * fully leave the field.
 */
export const FIELD_RAMP = [
  " ", "·", "-", ":", "/", "+", "=", ">", "<", "!", "?",
  "3", "I", "2", "5", "4", "6", "9", "8", "R", "0", "L", "Y", "A", "T",
] as const;
export const FIELD_RAMP_LEN = FIELD_RAMP.length;

/** Ambient density never exceeds this index — R 0 L Y A T are ceremony-only (§1). */
export const AMBIENT_CEIL = 14;

/** Block ramp stays for discrete UI indicators — WorkCard, BorderBeam, Wordmark (§1). */
export const BLOCK_RAMP = ["░", "▒", "▓", "█"] as const;

/** Mid-ramp field characters — the shared scramble alphabet (§1, §6b). */
export const SCRAMBLE_CHARS = ":/+=><!?3I25";

/**
 * Atlas glyph list: the full ramp plus the two flow-stroke variants that
 * aren't already ramp members ("-" and "/" are). Atlas index === ramp index
 * for ramp glyphs (§3b-A).
 */
export const ATLAS_GLYPHS: readonly string[] = [...FIELD_RAMP, "\\", "|"];
export const ATLAS_BACKSLASH = FIELD_RAMP_LEN; // 25
export const ATLAS_PIPE = FIELD_RAMP_LEN + 1; // 26
export const ATLAS_LEN = FIELD_RAMP_LEN + 2;

/** Shared materialization timing (§6b) — every ramp-walk on the page uses these. */
export const RESOLVE_CHAR_MS = 400;
export const RESOLVE_SWEEP_MS = 50;

// Slightly sub-linear curve lifts the faint low end of the ramp into visibility.
const LUMINANCE_GAMMA = 0.85;
// Alpha ceiling at the dense end of the full ramp (§2, §3).
const LUMINANCE_PEAK = 0.25;
// Cap on per-glyph alpha boost so near-invisible glyphs don't get blown out.
const MAX_COVERAGE_BOOST = 2.5;

/**
 * Base alpha for a continuous ramp position (0–24). Monotonic; ambient tops
 * out ~0.16 at AMBIENT_CEIL, the full ramp at 0.25 (§2, §3).
 */
export function luminance(rampPos: number): number {
  if (rampPos <= 0) return 0;
  return Math.pow(rampPos / (FIELD_RAMP_LEN - 1), LUMINANCE_GAMMA) * LUMINANCE_PEAK;
}

/**
 * Per-glyph alpha normalization from measured ink coverage (§1).
 * `coverage[i]` = fraction of atlas pixels inked for glyph i. Drawing with
 * `luminance(pos) × norm[glyph]` makes perceived brightness track the ramp,
 * not the glyph's shape.
 */
export function coverageNorm(coverage: Float32Array): Float32Array {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < coverage.length; i++) {
    if (coverage[i] > 0) {
      sum += coverage[i];
      n++;
    }
  }
  const ref = n > 0 ? sum / n : 1;
  const norm = new Float32Array(coverage.length);
  for (let i = 0; i < coverage.length; i++) {
    norm[i] = coverage[i] > 0 ? Math.min(MAX_COVERAGE_BOOST, ref / coverage[i]) : 1;
  }
  // The cap can leave a thin glyph dimmer than its ramp predecessor; since
  // luminance is strictly increasing, restoring non-decreasing effective
  // ink (norm × coverage) along the ramp repairs the monotonic guarantee
  // without reintroducing the unbounded boost. Only the ramp-ordered prefix
  // applies — atlas indices past FIELD_RAMP_LEN are flow glyphs. The floor is
  // carried across any zero-coverage gap (a non-rendering ramp glyph) so a gap
  // can't reset it and let the next glyph dip below the ink before the gap.
  const rampEnd = Math.min(coverage.length, FIELD_RAMP_LEN);
  let prevInk = 0;
  for (let i = 1; i < rampEnd; i++) {
    if (coverage[i] <= 0) continue; // skip gaps, keep the running floor
    let ink = norm[i] * coverage[i];
    if (ink < prevInk) {
      norm[i] = prevInk / coverage[i];
      ink = prevInk;
    }
    prevInk = ink;
  }
  return norm;
}

/** @deprecated Legacy 15-step ramp — deleted in the cleanup task once AsciiGrid is rewritten. */
export const RAMP = ["·", "-", ":", "/", "+", "=", "<", ">", "!", "?", "░", "▒", "▓", "█", "T"] as const;
export const RAMP_LEN = RAMP.length;
